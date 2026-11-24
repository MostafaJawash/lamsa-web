import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GIFTS_CATEGORY_SLUG,
  GIFTS_HREF,
  navState,
  tabForCategory,
} from "@/config/site";

const tiles = vi.hoisted(() => ({ result: { status: "empty" } as unknown }));
vi.mock("@/features/catalog/queries", () => ({
  getCategoryTiles: async () => tiles.result,
}));

import { getGiftsEntry } from "@/features/catalog/gifts";

const tile = (slug: string, name: string) => ({
  id: 1,
  slug,
  name,
  image: null,
});

beforeEach(() => {
  tiles.result = { status: "empty" };
});

describe("gift boxes entry point", () => {
  it("lives in one config constant", () => {
    expect(GIFTS_CATEGORY_SLUG).toBe("demo-gifts");
    expect(GIFTS_HREF).toBe(`/c/${GIFTS_CATEGORY_SLUG}`);
  });

  it("uses the backend category's own name", async () => {
    tiles.result = {
      status: "ok",
      data: [tile("makeup", "مكياج"), tile("demo-gifts", "علبة هدايا")],
    };
    expect(await getGiftsEntry()).toMatchObject({ label: "علبة هدايا" });
  });

  it("falls back to «علب الهدايا» for a blank name or when the backend is down", async () => {
    tiles.result = { status: "ok", data: [tile("demo-gifts", "  ")] };
    expect(await getGiftsEntry()).toMatchObject({ label: "علب الهدايا" });
    tiles.result = { status: "unavailable" };
    expect(await getGiftsEntry()).toMatchObject({ label: "علب الهدايا" });
  });

  it("is hidden (no crash) when the category is missing or has no products", async () => {
    tiles.result = { status: "ok", data: [tile("makeup", "مكياج")] };
    expect(await getGiftsEntry()).toBeNull();
    tiles.result = { status: "empty" };
    expect(await getGiftsEntry()).toBeNull();
  });

  it("marks the matching desktop tab", () => {
    expect(tabForCategory("demo-gifts")).toBe(GIFTS_HREF);
    expect(navState("/c/demo-gifts").desktopTab).toBe(GIFTS_HREF);
    expect(navState("/products").desktopTab).toBe("/products");
    expect(navState("/products/page/2").tab).toBe("categories");
  });
});
