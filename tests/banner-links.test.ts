import { describe, expect, it } from "vitest";

import { ctaKey, linkTarget } from "@/features/banners/links";

describe("linkTarget", () => {
  it("maps catalog links to site routes", () => {
    expect(linkTarget({ type: "category", value: "makeup" })).toEqual({
      kind: "internal",
      href: "/c/makeup",
    });
    expect(linkTarget({ type: "product", value: "velvet-lipstick" })).toEqual({
      kind: "internal",
      href: "/p/velvet-lipstick",
    });
    expect(linkTarget({ type: "brand", value: "demo-luma" })).toEqual({
      kind: "internal",
      href: "/brands/demo-luma",
    });
    expect(linkTarget({ type: "new" })).toEqual({
      kind: "internal",
      href: "/new",
    });
    expect(linkTarget({ type: "sale", value: null })).toEqual({
      kind: "internal",
      href: "/sale",
    });
  });

  it("encodes slugs", () => {
    expect(linkTarget({ type: "category", value: "عناية" })).toEqual({
      kind: "internal",
      href: `/c/${encodeURIComponent("عناية")}`,
    });
  });

  it("keeps https URLs external and rejects anything else", () => {
    expect(
      linkTarget({ type: "url", value: "https://example.com/offer" }),
    ).toEqual({
      kind: "external",
      href: "https://example.com/offer",
    });
    expect(linkTarget({ type: "url", value: "http://example.com" })).toEqual({
      kind: "none",
    });
    expect(linkTarget({ type: "url", value: "javascript:alert(1)" })).toEqual({
      kind: "none",
    });
  });

  it("turns none, incomplete and admin-only links into no link", () => {
    expect(linkTarget({ type: "none" })).toEqual({ kind: "none" });
    expect(linkTarget({ type: "category", value: "  " })).toEqual({
      kind: "none",
    });
    expect(linkTarget({ type: "product" })).toEqual({ kind: "none" });
    expect(linkTarget({ type: "admin_order", value: "4" })).toEqual({
      kind: "none",
    });
    expect(linkTarget({ type: "order", value: "4" })).toEqual({ kind: "none" });
  });
});

describe("ctaKey", () => {
  it("uses the prototype CTA texts", () => {
    expect(ctaKey({ type: "sale" })).toBe("home.banners.ctaSale");
    expect(ctaKey({ type: "new" })).toBe("home.banners.ctaNew");
    expect(ctaKey({ type: "category", value: "hair" })).toBe(
      "home.banners.ctaDefault",
    );
  });
});
