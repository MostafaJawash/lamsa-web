import { describe, expect, it } from "vitest";

import { guestLimits } from "@/config/site";
import {
  cartKey,
  cartQuantity,
  decodeCart,
  decodeFavorites,
  encodeCart,
  encodeFavorites,
  MAX_COOKIE_BYTES,
  parseCartKey,
  removeCartLine,
  setCartQuantity,
  type GuestCartItem,
} from "@/features/cart/guest-codec";

function raw(value: unknown): string {
  return `v1.${Buffer.from(JSON.stringify(value), "utf8").toString("base64url")}`;
}

const lipstick: GuestCartItem = {
  productId: 3,
  variantId: 12,
  quantity: 2,
  slug: "demo-velvet-lipstick",
};
const serum: GuestCartItem = {
  productId: 7,
  variantId: null,
  quantity: 1,
  slug: "سيروم-فيتامين",
};

describe("guest cart cookie", () => {
  it("round-trips, Arabic slugs included", () => {
    const value = encodeCart([lipstick, serum]);
    expect(value).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
    expect(decodeCart(value)).toEqual({
      items: [lipstick, serum],
      malformed: false,
    });
  });

  it("uses the compact format [[product, variant or 0, quantity, slug]]", () => {
    const value = encodeCart([serum]) ?? "";
    const json = Buffer.from(value.slice(3), "base64url").toString("utf8");
    expect(JSON.parse(json)).toEqual([[7, 0, 1, "سيروم-فيتامين"]]);
  });

  it("reads nothing from a missing cookie", () => {
    expect(decodeCart(undefined)).toEqual({ items: [], malformed: false });
    expect(decodeCart("")).toEqual({ items: [], malformed: false });
  });

  it.each([
    ["another version", `v2.${raw([[1, 0, 1, "a"]]).slice(3)}`],
    ["no version", Buffer.from('[[1,0,1,"a"]]').toString("base64url")],
    ["not base64url", "v1.***"],
    ["not JSON", `v1.${Buffer.from("{oops").toString("base64url")}`],
    ["not an array", raw({ items: [] })],
    ["bad UTF-8", `v1.${Buffer.from([0xff, 0xfe]).toString("base64url")}`],
  ])("flags %s as malformed (reset)", (_, value) => {
    expect(decodeCart(value)).toEqual({ items: [], malformed: true });
  });

  it("drops invalid entries one by one", () => {
    const decoded = decodeCart(
      raw([
        [1, 0, 1, "ok"],
        [0, 0, 1, "zero id"],
        [2, -1, 1, "bad variant"],
        [3, 0, 0, "zero quantity"],
        [4, 0, 1.5, "fraction"],
        [5, 0, 1, 42],
        [6, 0, 1, "control\u0007"],
        "not an entry",
        [7, 0, 1, "x".repeat(201)],
      ]),
    );
    expect(decoded.malformed).toBe(false);
    expect(decoded.items.map((i) => i.productId)).toEqual([1]);
  });

  it("merges duplicate lines and keeps the limits", () => {
    const duplicates = decodeCart(
      raw([
        [1, 0, 60, "a"],
        [1, 0, 60, "a"],
      ]),
    );
    expect(duplicates.items).toEqual([
      {
        productId: 1,
        variantId: null,
        quantity: guestLimits.maxQuantity,
        slug: "a",
      },
    ]);
    const many = Array.from({ length: guestLimits.cartLines + 5 }, (_, i) => [
      i + 1,
      0,
      1,
      "s",
    ]);
    expect(decodeCart(raw(many)).items).toHaveLength(guestLimits.cartLines);
  });

  it("refuses a cart that would not fit in a cookie", () => {
    const long = Array.from({ length: 40 }, (_, i) => ({
      ...serum,
      productId: i + 1,
      slug: "x".repeat(150),
    }));
    expect(encodeCart(long)).toBeNull();
    const ok = encodeCart(long.slice(0, 5));
    expect(ok && ok.length).toBeLessThanOrEqual(MAX_COOKIE_BYTES);
  });

  it("sets, adds and removes lines by key", () => {
    let items = setCartQuantity([], lipstick, 2);
    items = setCartQuantity(items, serum, 1);
    items = setCartQuantity(items, lipstick, 5);
    expect(
      items.map((i) => [cartKey(i.productId, i.variantId), i.quantity]),
    ).toEqual([
      ["3:12", 5],
      ["7:0", 1],
    ]);
    expect(setCartQuantity(items, serum, 500).at(-1)?.quantity).toBe(
      guestLimits.maxQuantity,
    );
    expect(cartQuantity(items)).toBe(6);
    expect(removeCartLine(items, "3:12").map((i) => i.productId)).toEqual([7]);
  });

  it("parses line keys strictly", () => {
    expect(parseCartKey("3:12")).toEqual({ productId: 3, variantId: 12 });
    expect(parseCartKey("7:0")).toEqual({ productId: 7, variantId: null });
    for (const bad of ["", "0:0", "3", "3:-1", "a:b", "3:12:1", 5])
      expect(parseCartKey(bad)).toBeNull();
  });
});

describe("guest favorites cookie", () => {
  it("round-trips and drops duplicates", () => {
    const items = [
      { productId: 3, slug: "a" },
      { productId: 9, slug: "b" },
    ];
    expect(decodeFavorites(encodeFavorites(items))).toEqual({
      items,
      malformed: false,
    });
    expect(
      decodeFavorites(
        raw([
          [3, "a"],
          [3, "a"],
          [0, "z"],
        ]),
      ).items,
    ).toEqual([{ productId: 3, slug: "a" }]);
  });

  it("keeps the newest favorites over the limit", () => {
    const many = Array.from({ length: guestLimits.favorites + 3 }, (_, i) => [
      i + 1,
      "",
    ]);
    const items = decodeFavorites(raw(many)).items;
    expect(items).toHaveLength(guestLimits.favorites);
    expect(items[0]?.productId).toBe(4);
  });

  it("drops the oldest slugs to fit 200 favorites in a cookie", () => {
    const items = Array.from({ length: guestLimits.favorites }, (_, i) => ({
      productId: 100_000 + i,
      slug: `demo-product-with-a-long-name-${i}`,
    }));
    const value = encodeFavorites(items);
    expect(value).not.toBeNull();
    expect(value!.length).toBeLessThanOrEqual(MAX_COOKIE_BYTES);
    const decoded = decodeFavorites(value).items;
    expect(decoded.map((f) => f.productId)).toEqual(
      items.map((f) => f.productId),
    );
    expect(decoded.at(-1)?.slug).toBe(items.at(-1)?.slug);
    expect(decoded[0]?.slug).toBe("");
  });

  it("flags garbage as malformed", () => {
    expect(decodeFavorites("garbage").malformed).toBe(true);
  });
});
