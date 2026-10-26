import { describe, expect, it } from "vitest";

import {
  defaultVariantId,
  findVariant,
  imagesFor,
  maxQuantity,
  pickVariant,
  priceView,
  stockView,
  variantFromParam,
  variantLabel,
} from "@/features/catalog/variants";

import { lipstick, mist } from "./fixtures/products";

describe("variant selection", () => {
  it("defaults to the first in-stock variant", () => {
    expect(defaultVariantId(lipstick)).toBe(2);
    expect(defaultVariantId(mist)).toBeNull();
  });

  it("accepts ?v only for the product's own variants", () => {
    expect(variantFromParam(lipstick, "3")).toBe(3);
    expect(variantFromParam(lipstick, ["1", "2"])).toBe(1);
    expect(variantFromParam(lipstick, "99")).toBeNull();
    expect(variantFromParam(lipstick, "1abc")).toBeNull();
    expect(variantFromParam(lipstick, undefined)).toBeNull();
  });

  it("picks the variant for a chosen value", () => {
    const current = findVariant(lipstick, 2);
    expect(pickVariant(lipstick, current, "color", "نيود دافئ")?.id).toBe(3);
    expect(pickVariant(lipstick, current, "color", "nope")?.id).toBe(2);
    expect(variantLabel(lipstick, findVariant(lipstick, 3)!)).toBe("نيود دافئ");
  });
});

describe("price, stock and images", () => {
  it("shows the sale price, the struck regular price and the savings (no float errors)", () => {
    expect(priceView(lipstick, findVariant(lipstick, 2))).toEqual({
      current: "7.45",
      regular: "9.95",
      savings: "2.50",
    });
    expect(priceView(lipstick, findVariant(lipstick, 3))).toEqual({
      current: "8.95",
      regular: null,
      savings: null,
    });
    expect(priceView(mist, null)).toEqual({
      current: "4.95",
      regular: "6.95",
      savings: "2.00",
    });
  });

  it("reads the stock of the variant or the product", () => {
    expect(stockView(lipstick, findVariant(lipstick, 2))).toEqual({
      status: "low",
      left: 3,
    });
    expect(stockView(mist, null)).toEqual({ status: "out", left: null });
  });

  it("bounds the quantity to 1..10 and the stock left", () => {
    expect(maxQuantity({ status: "low", left: 3 })).toBe(3);
    expect(maxQuantity({ status: "in_stock", left: null })).toBe(10);
    expect(maxQuantity({ status: "out", left: null })).toBe(1);
  });

  it("shows the variant's images in image_ids order, else the general ones", () => {
    expect(
      imagesFor(lipstick, findVariant(lipstick, 2)).map((i) => i.id),
    ).toEqual([3, 1]);
    expect(
      imagesFor(lipstick, findVariant(lipstick, 3)).map((i) => i.id),
    ).toEqual([1]);
    expect(imagesFor(lipstick, null).map((i) => i.id)).toEqual([1]);
  });
});
