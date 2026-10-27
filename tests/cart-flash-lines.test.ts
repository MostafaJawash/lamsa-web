import { afterEach, describe, expect, it, vi } from "vitest";

import { badgeStore, badgeText } from "@/features/cart/badge-store";
import {
  decodeFlash,
  encodeFlash,
  flashToast,
  mergeFlash,
} from "@/features/cart/flash";
import {
  cartError,
  cartErrorFrom,
  cartErrorText,
  guestFixes,
  guestLineError,
  homeQuote,
  issueText,
  lineKey,
  lineRef,
} from "@/features/cart/lines";
import type { AnyCart, LineIssue } from "@/features/cart/types";
import { ApiError } from "@/lib/errors";

function line(
  id: number,
  variant: number | null,
  quantity: number,
  issue: LineIssue | null = null,
) {
  return {
    key: `${id}:${variant ?? 0}`,
    quantity,
    product: {
      id,
      slug: `p${id}`,
      name: `P${id}`,
      type: "simple",
      brand: null,
    },
    variant: variant ? { id: variant, options: {}, label: "50 ml" } : null,
    image: null,
    unit_price: "5.00",
    regular_price: "5.00",
    compare_at_price: null,
    discount_percent: null,
    line_total: issue ? "0.00" : "5.00",
    stock_status: "in_stock",
    stock_left: null,
    items: [],
    issue,
  };
}

function preview(lines: ReturnType<typeof line>[]): AnyCart {
  return {
    lines,
    items_count: 0,
    lines_count: lines.length,
    subtotal: "0.00",
    savings: "0.00",
    delivery_quotes: [
      {
        code: "pickup",
        name: "x",
        description: null,
        fee: "0.00",
        is_free: true,
        free_from: null,
        amount_to_free_shipping: null,
        requires_address: false,
      },
      {
        code: "home",
        name: "y",
        description: null,
        fee: "4.95",
        is_free: false,
        free_from: "49.00",
        amount_to_free_shipping: "44.00",
        requires_address: true,
      },
    ],
    can_checkout: false,
    issues_count: 0,
    notices: [],
  } as unknown as AnyCart;
}

const issue = (
  code: LineIssue["code"],
  extra: Partial<LineIssue> = {},
): LineIssue => ({
  code,
  message: "backend text",
  available: null,
  max: null,
  ...extra,
});

describe("flash cookie", () => {
  it("round-trips every kind", () => {
    const flashes = [
      { kind: "merge", restored: 3, adjusted: true },
      { kind: "cartAdded" },
      { kind: "favAdded" },
      { kind: "favRemoved" },
      { kind: "moved" },
      { kind: "error", code: "INSUFFICIENT_STOCK", n: 2 },
      { kind: "error", code: "OUT_OF_STOCK", n: null },
    ] as const;
    for (const flash of flashes) {
      const value = encodeFlash(flash, "abc12345");
      expect(value).toMatch(/^v1\.abc12345\./);
      expect(decodeFlash(value)).toEqual({ id: "abc12345", flash });
    }
  });

  it("rejects anything else", () => {
    for (const bad of [
      null,
      "",
      "v2.abc12345.moved",
      "v1.ab.moved",
      "v1.abc12345.hack",
      "v1.abc12345.moved.1",
      "v1.abc12345.merge.x.1",
      "v1.abc12345.error.lower",
      `v1.abc12345.error.${"A".repeat(200)}`,
    ])
      expect(decodeFlash(bad)).toBeNull();
  });

  it("turns a merge report into the toast", () => {
    const report = (...statuses: string[]) =>
      statuses.map((status) => ({ status }));
    expect(mergeFlash(report("added", "merged", "capped"))).toEqual({
      kind: "merge",
      restored: 3,
      adjusted: true,
    });
    expect(flashToast(mergeFlash(report("added", "added", "added")))).toEqual({
      text: "أعدنا 3 منتجات إلى سلتك",
      sub: undefined,
      action: { label: "عرض السلة", href: "/cart" },
    });
    expect(flashToast(mergeFlash(report("added", "skipped")))?.sub).toBe(
      "عُدّلت بعض المنتجات وفقًا للمخزون المتوفر",
    );
    expect(flashToast(mergeFlash(report("added")))?.text).toBe(
      "أعدنا منتج واحد إلى سلتك",
    );
    expect(flashToast(mergeFlash([]))).toBeNull();
    expect(flashToast(mergeFlash(report("skipped")))?.text).toBe(
      "عُدّلت بعض المنتجات وفقًا للمخزون المتوفر",
    );
  });

  it("has the prototype toasts", () => {
    expect(flashToast({ kind: "cartAdded" })).toMatchObject({
      text: "أُضيف إلى السلة",
      action: { label: "عرض السلة", href: "/cart" },
    });
    expect(flashToast({ kind: "favAdded" })).toMatchObject({
      text: "أُضيف إلى المفضلة",
      action: { label: "المفضلة" },
    });
    expect(flashToast({ kind: "favRemoved" })).toEqual({
      text: "أُزيل من المفضلة",
    });
    expect(
      flashToast({ kind: "error", code: "INSUFFICIENT_STOCK", n: 2 })?.text,
    ).toBe("لم يتبقَّ سوى 2");
  });
});

describe("cart errors and issues", () => {
  it("maps backend errors with their details", () => {
    const error = cartErrorFrom(
      new ApiError(409, "INSUFFICIENT_STOCK", "رسالة", {
        product_id: 1,
        variant_id: null,
        available: 2,
      }),
    );
    expect(error).toEqual({
      code: "INSUFFICIENT_STOCK",
      message: "رسالة",
      available: 2,
      max: null,
    });
    expect(cartErrorText(error)).toBe("لم يتبقَّ سوى 2");
    expect(
      cartErrorText(
        cartErrorFrom(
          new ApiError(422, "QUANTITY_LIMIT_EXCEEDED", null, { max: 10 }),
        ),
      ),
    ).toBe("الحد الأقصى 10");
    expect(cartErrorText(cartError("FAVORITES_LIMIT_REACHED"))).toMatch(
      /[؀-ۿ]/,
    );
    expect(cartErrorFrom(new Error("x")).code).toBe("UNKNOWN_ERROR");
  });

  it("gives the guest the same errors as POST /cart/items", () => {
    const cart = preview([
      line(1, null, 3, issue("INSUFFICIENT_STOCK", { available: 2 })),
      line(2, null, 1, issue("OUT_OF_STOCK")),
      line(3, null, 11, issue("QUANTITY_LIMIT_EXCEEDED", { max: 10 })),
      line(4, null, 1, issue("VARIANT_UNAVAILABLE")),
      line(5, 9, 1, issue("VARIANT_UNAVAILABLE")),
      line(6, null, 1, issue("UNAVAILABLE")),
      line(7, null, 1),
    ]);
    const code = (key: string, variant = false) =>
      guestLineError(cart, key, variant);
    expect(code("1:0")).toMatchObject({
      code: "INSUFFICIENT_STOCK",
      available: 2,
    });
    expect(code("2:0")?.code).toBe("OUT_OF_STOCK");
    expect(code("3:0")).toMatchObject({
      code: "QUANTITY_LIMIT_EXCEEDED",
      max: 10,
    });
    expect(code("4:0")?.code).toBe("VARIANT_REQUIRED");
    expect(code("5:9", true)?.code).toBe("VARIANT_NOT_FOUND");
    expect(code("6:0")?.code).toBe("PRODUCT_NOT_FOUND");
    expect(code("7:0")).toBeNull();
    expect(code("99:0")?.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("fixes a guest cart like resolve-issues", () => {
    const fixes = guestFixes(
      preview([
        line(1, null, 3, issue("INSUFFICIENT_STOCK", { available: 2 })),
        line(2, null, 1, issue("OUT_OF_STOCK")),
        line(3, null, 11, issue("QUANTITY_LIMIT_EXCEEDED", { max: 10 })),
        line(4, null, 1, issue("UNAVAILABLE")),
        line(5, 9, 1, issue("VARIANT_UNAVAILABLE")),
        line(6, null, 1),
      ]),
    );
    expect(fixes.remove).toEqual(["2:0", "4:0", "5:9"]);
    expect([...fixes.cap]).toEqual([
      ["1:0", 2],
      ["3:0", 10],
    ]);
  });

  it("names lines and reads the home quote", () => {
    const cart = preview([line(5, 9, 1)]);
    const first = cart.lines[0]!;
    expect(lineKey(first)).toBe("5:9");
    expect(lineRef(first)).toBe("5:9");
    expect(lineRef({ ...first, id: 42 } as never)).toBe("42");
    expect(homeQuote(cart)?.code).toBe("home");
    expect(issueText(issue("INSUFFICIENT_STOCK", { available: 3 }))).toBe(
      "لم يتبقَّ سوى 3",
    );
    expect(issueText(issue("QUANTITY_LIMIT_EXCEEDED", { max: 10 }))).toBe(
      "الحد الأقصى 10",
    );
    expect(issueText(issue("VARIANT_UNAVAILABLE"))).toBe(
      "لم يعد هذا الخيار متوفرًا",
    );
  });
});

describe("badge store", () => {
  afterEach(() => badgeStore.reset());

  it("is empty until seeded and notifies on change only", () => {
    const listener = vi.fn();
    const unsubscribe = badgeStore.subscribe(listener);
    expect(badgeStore.get("cart")).toBeNull();
    badgeStore.set({ cart: 2 });
    badgeStore.set({ cart: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
    badgeStore.set({ favorites: 4, cart: -1 });
    expect([badgeStore.get("cart"), badgeStore.get("favorites")]).toEqual([
      2, 4,
    ]);
    unsubscribe();
    badgeStore.set({ cart: 3 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("applies and undoes optimistic changes", () => {
    badgeStore.add("favorites", 1); // not seeded: ignored
    expect(badgeStore.get("favorites")).toBeNull();
    badgeStore.set({ favorites: 1 });
    const undo = badgeStore.add("favorites", -1);
    expect(badgeStore.get("favorites")).toBe(0);
    undo();
    expect(badgeStore.get("favorites")).toBe(1);
  });

  it("caps the text at 99+", () => {
    expect(badgeText(7)).toBe("7");
    expect(badgeText(100)).toBe("99+");
  });
});
