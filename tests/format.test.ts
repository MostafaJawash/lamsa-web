import { describe, expect, it } from "vitest";

import { formatDate, formatPrice, pluralize } from "@/lib/format";

describe("formatPrice", () => {
  it("formats the backend's two-decimal strings", () => {
    expect(formatPrice("8.95")).toBe("8,95 €");
    expect(formatPrice("0.00")).toBe("0,00 €");
    expect(formatPrice("49.90")).toBe("49,90 €");
  });

  it("groups thousands without floating-point errors", () => {
    expect(formatPrice("1234.50")).toBe("1.234,50 €");
    expect(formatPrice("1000000.01")).toBe("1.000.000,01 €");
  });

  it("pads a missing decimal and keeps a sign", () => {
    expect(formatPrice("12")).toBe("12,00 €");
    expect(formatPrice("12.5")).toBe("12,50 €");
    expect(formatPrice("-3.20")).toBe("-3,20 €");
  });

  it("returns anything that is not a money string unchanged", () => {
    expect(formatPrice("abc")).toBe("abc");
  });
});

describe("formatDate", () => {
  it("formats in Arabic with Latin digits in the store time zone", () => {
    expect(formatDate("2026-10-22T17:00:00")).toBe("22 أكتوبر 2026");
  });

  it("reads timestamps without offset as UTC", () => {
    // 23:30 UTC is already the next day in Berlin (UTC+2 in summer time).
    expect(formatDate("2026-07-01T23:30:00")).toBe("2 يوليو 2026");
    expect(formatDate("2026-07-01T23:30:00Z")).toBe("2 يوليو 2026");
  });

  it("returns invalid input unchanged", () => {
    expect(formatDate("not a date")).toBe("not a date");
  });
});

describe("pluralize", () => {
  it("uses every Arabic plural form", () => {
    expect(pluralize(0, "products")).toBe("لا توجد منتجات");
    expect(pluralize(1, "products")).toBe("منتج واحد");
    expect(pluralize(2, "products")).toBe("منتجان");
    expect(pluralize(3, "products")).toBe("3 منتجات");
    expect(pluralize(10, "products")).toBe("10 منتجات");
    expect(pluralize(11, "products")).toBe("11 منتجًا");
    expect(pluralize(99, "products")).toBe("99 منتجًا");
    expect(pluralize(100, "products")).toBe("100 منتج");
  });

  it("works for other nouns", () => {
    expect(pluralize(0, "items")).toBe("لا توجد قطع");
    expect(pluralize(2, "items")).toBe("قطعتان");
    expect(pluralize(3, "items")).toBe("3 قطع");
    expect(pluralize(11, "items")).toBe("11 قطعة");
    expect(pluralize(0, "brands")).toBe("لا توجد ماركات");
    expect(pluralize(2, "brands")).toBe("ماركتان");
    expect(pluralize(11, "brands")).toBe("11 ماركة");
  });
});
