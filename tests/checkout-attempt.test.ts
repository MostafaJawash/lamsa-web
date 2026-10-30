import { describe, expect, it } from "vitest";

import {
  idempotencyKey,
  isAttemptId,
  newAttemptId,
  type AttemptSnapshot,
} from "@/features/checkout/attempt";
import { checkoutHref } from "@/features/checkout/links";
import {
  parseTotals,
  serializeTotals,
  totalsToMap,
} from "@/features/checkout/totals";

const snapshot: AttemptSnapshot = {
  addressId: 7,
  method: "damascus_courier",
  notes: "اتصل قبل الوصول",
  gift: "",
  totals: { SYP: "94000.00", USD: "39.90" },
};

describe("checkout attempt and Idempotency-Key", () => {
  const attempt = newAttemptId();

  it("generates fresh, well-formed attempt ids", () => {
    expect(isAttemptId(attempt)).toBe(true);
    expect(newAttemptId()).not.toBe(attempt);
    expect(isAttemptId("not-a-uuid")).toBe(false);
    expect(isAttemptId(undefined)).toBe(false);
  });

  it("derives a key the backend accepts (1..64 of letters, digits, - and _)", () => {
    expect(idempotencyKey(attempt, snapshot)).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it("keeps the same key for a genuine retry of the same attempt", () => {
    expect(idempotencyKey(attempt, snapshot)).toBe(
      idempotencyKey(attempt, { ...snapshot }),
    );
    // Whitespace around the notes is not a change (the backend trims them).
    expect(
      idempotencyKey(attempt, { ...snapshot, notes: `  ${snapshot.notes} \n` }),
    ).toBe(idempotencyKey(attempt, snapshot));
    // Neither is the order of the currencies.
    expect(
      idempotencyKey(attempt, {
        ...snapshot,
        totals: { USD: "39.90", SYP: "94000.00" },
      }),
    ).toBe(idempotencyKey(attempt, snapshot));
  });

  it("derives a new key when anything material changes", () => {
    const base = idempotencyKey(attempt, snapshot);
    const changes: Partial<AttemptSnapshot>[] = [
      { addressId: 8 },
      { method: "province_shipping" },
      { notes: "ملاحظة أخرى" },
      { gift: "هدية" },
      { totals: { SYP: "79000.00", USD: "39.90" } },
      { totals: { SYP: "94000.00" } },
    ];
    for (const change of changes)
      expect(
        idempotencyKey(attempt, { ...snapshot, ...change }),
        JSON.stringify(change),
      ).not.toBe(base);
  });

  it("derives a new key for a new page render (a new attempt), even with the same inputs", () => {
    expect(idempotencyKey(newAttemptId(), snapshot)).not.toBe(
      idempotencyKey(attempt, snapshot),
    );
  });
});

describe("checkout totals field", () => {
  const quote = [
    { currency: "SYP", amount: "94000.00" },
    { currency: "USD", amount: "39.90" },
  ];

  it("round-trips the backend's per-currency totals without arithmetic", () => {
    expect(totalsToMap(quote)).toEqual({ SYP: "94000.00", USD: "39.90" });
    expect(parseTotals(serializeTotals(quote))).toEqual({
      SYP: "94000.00",
      USD: "39.90",
    });
  });

  it("refuses anything that is not one or two known currencies with money strings", () => {
    expect(parseTotals("")).toBeNull();
    expect(parseTotals("{}")).toBeNull();
    expect(parseTotals("[]")).toBeNull();
    expect(parseTotals("not json")).toBeNull();
    expect(parseTotals('{"EUR":"5.00"}')).toBeNull();
    expect(parseTotals('{"SYP":"12"}')).toBeNull();
    expect(parseTotals('{"SYP":"1.00","USD":"2.00","EUR":"3.00"}')).toBeNull();
    expect(parseTotals(null)).toBeNull();
  });
});

describe("checkoutHref", () => {
  it("keeps the selection and the notice in the URL", () => {
    expect(checkoutHref()).toBe("/checkout");
    expect(checkoutHref({ address: 3, method: "province_shipping" })).toBe(
      "/checkout?address=3&method=province_shipping",
    );
    expect(checkoutHref({ address: 3, notice: "price" })).toBe(
      "/checkout?address=3&notice=price",
    );
    expect(checkoutHref({ newAddress: true })).toBe("/checkout?new=1");
  });

  it("carries typed notes only when there are any", () => {
    expect(checkoutHref({ notes: "   " })).toBe("/checkout");
    expect(
      new URL(checkoutHref({ notes: "مرحبا" }), "http://x").searchParams.get(
        "notes",
      ),
    ).toBe("مرحبا");
  });
});
