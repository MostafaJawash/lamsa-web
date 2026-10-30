import { beforeEach, describe, expect, it, vi } from "vitest";

import { placeOrder } from "@/features/checkout/actions";
import { idempotencyKey, newAttemptId } from "@/features/checkout/attempt";
import { readFailure } from "@/lib/form-failure";

/** A redirect, as `next/navigation` throws it. */
class Redirect extends Error {
  constructor(readonly url: string) {
    super(`redirect ${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
const setFlash = vi.fn();
vi.mock("@/features/cart/guest-store", () => ({
  setFlash: (flash: unknown) => setFlash(flash),
}));

type Reply = {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
};
let replies: Reply[] = [];
const calls: { key: string | undefined; body: Record<string, unknown> }[] = [];

vi.mock("@/lib/auth/action-session", () => ({
  withAccess: async (call: (api: unknown) => Promise<unknown>) =>
    call({
      POST: async (
        _path: string,
        init: {
          params: { header: Record<string, string> };
          body: Record<string, unknown>;
        },
      ) => {
        calls.push({
          key: init.params.header["Idempotency-Key"],
          body: init.body,
        });
        const reply = replies.shift();
        if (!reply) throw new Error("no reply queued");
        const response = new Response(null, {
          status: reply.status,
          headers: reply.headers,
        });
        return reply.status < 400
          ? { data: reply.body, response }
          : { error: reply.body, response };
      },
    }),
}));

const attempt = newAttemptId();
const totals = { SYP: "94000.00", USD: "39.90" };

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const base: Record<string, string> = {
    attempt,
    address_id: "3",
    method: "damascus_courier",
    expected_totals: JSON.stringify(totals),
    customer_notes: "اتصل قبل الوصول",
    gift_message: "",
    js: "1",
  };
  for (const [name, value] of Object.entries({ ...base, ...overrides }))
    data.set(name, value);
  return data;
}

function failure(
  code: string,
  status: number,
  message = "رسالة الخادم",
  details: unknown = null,
): Reply {
  return { status, body: { error: { code, message, details } } };
}

/** What the action does: the redirect it throws, or the state it returns. */
async function run(data: FormData) {
  try {
    return { state: await placeOrder(null, data), redirect: null };
  } catch (error) {
    if (error instanceof Redirect)
      return { state: undefined, redirect: error.url };
    throw error;
  }
}

beforeEach(() => {
  replies = [];
  calls.length = 0;
  setFlash.mockClear();
});

describe("placeOrder", () => {
  it("sends the confirmed totals with the derived key, then goes to the success page", async () => {
    replies = [{ status: 201, body: { id: 5 } }];
    const result = await run(form());
    expect(result.redirect).toBe("/checkout/success/5");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.key).toBe(
      idempotencyKey(attempt, {
        addressId: 3,
        method: "damascus_courier",
        notes: "اتصل قبل الوصول",
        gift: "",
        totals,
      }),
    );
    expect(calls[0]!.body).toEqual({
      delivery_method_code: "damascus_courier",
      address_id: 3,
      customer_notes: "اتصل قبل الوصول",
      gift_message: null,
      expected_totals: totals,
    });
  });

  it("uses the same key for the same attempt and another for a changed input", async () => {
    replies = [
      { status: 200, body: { id: 5 } },
      { status: 200, body: { id: 5 } },
      { status: 201, body: { id: 6 } },
    ];
    await run(form());
    await run(form());
    await run(form({ customer_notes: "ملاحظة أخرى" }));
    expect(calls[0]!.key).toBe(calls[1]!.key);
    expect(calls[2]!.key).not.toBe(calls[0]!.key);
  });

  it("retries a busy backend once with the SAME key, then succeeds", async () => {
    replies = [
      {
        ...failure("SERVICE_BUSY", 503, "الخادم مشغول"),
        headers: { "Retry-After": "1" },
      },
      { status: 200, body: { id: 5 } },
    ];
    const result = await run(form());
    expect(result.redirect).toBe("/checkout/success/5");
    expect(calls).toHaveLength(2);
    expect(calls[1]!.key).toBe(calls[0]!.key);
  });

  it("shows the backend's message when the retry fails too (and keeps the notes)", async () => {
    replies = [
      {
        ...failure("SERVICE_BUSY", 503, "الخادم مشغول حاليًا"),
        headers: { "Retry-After": "1" },
      },
      {
        ...failure("SERVICE_BUSY", 503, "الخادم مشغول حاليًا"),
        headers: { "Retry-After": "1" },
      },
    ];
    const result = await run(form());
    expect(calls).toHaveLength(2);
    expect(result.state).toEqual({
      message: "الخادم مشغول حاليًا",
      notes: "اتصل قبل الوصول",
      gift: "",
    });
  });

  it("does not retry other failures", async () => {
    replies = [failure("SKU_TAKEN", 409, "رمز المنتج مستخدم.")];
    const result = await run(form());
    expect(calls).toHaveLength(1);
    expect(result.state?.message).toBe("رمز المنتج مستخدم.");
  });

  it.each([
    ["CART_EMPTY", 422, "/cart"],
    ["CART_HAS_ISSUES", 409, "/cart"],
    [
      "PRICE_CHANGED",
      409,
      "/checkout?address=3&method=damascus_courier&notes=%D8%A7%D8%AA%D8%B5%D9%84+%D9%82%D8%A8%D9%84+%D8%A7%D9%84%D9%88%D8%B5%D9%88%D9%84&notice=price",
    ],
    [
      "DELIVERY_METHOD_NOT_AVAILABLE",
      422,
      "/checkout?address=3&notes=%D8%A7%D8%AA%D8%B5%D9%84+%D9%82%D8%A8%D9%84+%D8%A7%D9%84%D9%88%D8%B5%D9%88%D9%84&notice=method",
    ],
    [
      "DELIVERY_METHOD_NOT_FOUND",
      422,
      "/checkout?address=3&notes=%D8%A7%D8%AA%D8%B5%D9%84+%D9%82%D8%A8%D9%84+%D8%A7%D9%84%D9%88%D8%B5%D9%88%D9%84&notice=method",
    ],
    [
      "ADDRESS_REQUIRED",
      422,
      "/checkout?notes=%D8%A7%D8%AA%D8%B5%D9%84+%D9%82%D8%A8%D9%84+%D8%A7%D9%84%D9%88%D8%B5%D9%88%D9%84&notice=address",
    ],
    [
      "ADDRESS_NOT_FOUND",
      404,
      "/checkout?notes=%D8%A7%D8%AA%D8%B5%D9%84+%D9%82%D8%A8%D9%84+%D8%A7%D9%84%D9%88%D8%B5%D9%88%D9%84&notice=address",
    ],
    [
      "INVALID_LOCATION",
      422,
      "/checkout?notes=%D8%A7%D8%AA%D8%B5%D9%84+%D9%82%D8%A8%D9%84+%D8%A7%D9%84%D9%88%D8%B5%D9%88%D9%84&notice=location",
    ],
  ])("maps %s (%i) to %s", async (code, status, location) => {
    replies = [failure(code, status)];
    const result = await run(form());
    expect(result.redirect).toBe(location);
  });

  it("sends insufficient stock to the cart with the available quantity", async () => {
    replies = [
      failure("INSUFFICIENT_STOCK", 409, "x", {
        product_id: 1,
        variant_id: null,
        available: 2,
      }),
    ];
    const result = await run(form());
    expect(result.redirect).toBe("/cart");
    expect(setFlash).toHaveBeenCalledWith({
      kind: "error",
      code: "INSUFFICIENT_STOCK",
      n: 2,
    });
  });

  it("sends a signed-out customer to login and back", async () => {
    replies = [failure("NOT_AUTHENTICATED", 401)];
    const result = await run(form());
    expect(result.redirect).toBe("/login?next=%2Fcheckout");
  });

  it("refuses a form without totals, a method, an address or a live attempt", async () => {
    expect((await run(form({ expected_totals: "" }))).state?.message).toMatch(
      /طريقة التوصيل/,
    );
    expect((await run(form({ method: "" }))).state?.message).toMatch(
      /طريقة التوصيل/,
    );
    expect((await run(form({ address_id: "" }))).state?.message).toBeTruthy();
    expect((await run(form({ attempt: "nope" }))).state?.message).toBeTruthy();
    expect(
      (await run(form({ customer_notes: "ن".repeat(501) }))).state?.message,
    ).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("hands a failure back by redirect when JavaScript did not post it", async () => {
    replies = [failure("SKU_TAKEN", 409, "رمز المنتج مستخدم.")];
    const data = form();
    data.delete("js");
    const result = await run(data);
    const match =
      /^\/checkout\?address=3&method=damascus_courier&fs=([\w-]+)$/.exec(
        result.redirect ?? "",
      );
    expect(match).not.toBeNull();
    expect(readFailure(match![1])).toEqual({
      message: "رمز المنتج مستخدم.",
      notes: "اتصل قبل الوصول",
      gift: "",
    });
    expect(readFailure("not-an-id")).toBeNull();
    expect(readFailure("abcdefghijklmnopqrstuvwx")).toBeNull();
  });

  it("the no-JavaScript refresh button only re-renders the page for the new selection", async () => {
    const result = await run(
      form({ intent: "refresh", address_id: "4", method: "province_shipping" }),
    );
    expect(result.redirect).toMatch(
      /^\/checkout\?address=4&method=province_shipping&notes=/,
    );
    expect(calls).toHaveLength(0);
  });
});
