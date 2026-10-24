import { describe, expect, it } from "vitest";

import { tileColumns } from "@/components/shared/category-tile";
import { navState } from "@/config/site";

describe("navState", () => {
  it("home: logo header, home tab, no desktop tab", () => {
    expect(navState("/")).toEqual({
      desktopTab: null,
      tab: "home",
      titleKey: null,
      isRoot: true,
    });
  });

  it("marks the desktop tab of the current section", () => {
    expect(navState("/new").desktopTab).toBe("/new");
    expect(navState("/brands/demo-luma").desktopTab).toBe("/brands");
    expect(navState("/c/makeup").desktopTab).toBe("/c/makeup");
    expect(navState("/c/makeup/").desktopTab).toBe("/c/makeup");
    expect(navState("/c/perfumes").desktopTab).toBeNull();
  });

  it("follows the prototype tabOf map for the tabbar", () => {
    expect(navState("/categories").tab).toBe("categories");
    expect(navState("/p/velvet-lipstick").tab).toBe("categories");
    expect(navState("/search").tab).toBe("categories");
    expect(navState("/checkout/success/45").tab).toBe("cart");
    expect(navState("/login").tab).toBe("account");
    expect(navState("/complete-profile").tab).toBe("account");
    expect(navState("/account/orders/4").tab).toBe("account");
  });

  it("gives root pages no back button", () => {
    expect(navState("/cart").isRoot).toBe(true);
    expect(navState("/account").isRoot).toBe(true);
    expect(navState("/login").isRoot).toBe(false);
    expect(navState("/p/x").isRoot).toBe(false);
  });

  it("titles every page, unknown routes as not found", () => {
    expect(navState("/p/x").titleKey).toBe("pages.product");
    expect(navState("/account/orders/4").titleKey).toBe("pages.orderDetail");
    expect(navState("/nope").titleKey).toBe("errors.notFoundTitle");
  });
});

describe("tileColumns", () => {
  it("avoids an orphan tile on desktop", () => {
    expect([1, 2, 3, 4].map(tileColumns)).toEqual([1, 2, 3, 4]);
    expect([5, 6, 7, 8].map(tileColumns)).toEqual([3, 3, 4, 4]);
    expect(tileColumns(9)).toBe(4);
  });
});
