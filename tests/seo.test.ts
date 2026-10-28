import { describe, expect, it } from "vitest";

import { filterChips } from "@/features/catalog/filter-labels";
import { parseFilters } from "@/features/catalog/filters";
import {
  breadcrumbJsonLd,
  listCanonical,
  listMetadata,
  productJsonLd,
  productMetadata,
  trimDescription,
} from "@/features/catalog/seo";
import type { Facets } from "@/features/catalog/types";

import { lipstick, mist } from "./fixtures/products";

const SITE = "http://localhost:3000";

describe("metadata builders", () => {
  it("trims descriptions at a word boundary", () => {
    expect(trimDescription("  قصير   جداً ")).toBe("قصير جداً");
    const long = "كلمة ".repeat(60);
    const trimmed = trimDescription(long, 50);
    expect(trimmed.length).toBeLessThanOrEqual(50);
    expect(trimmed.endsWith("…")).toBe(true);
  });

  it("list canonical keeps only ?page", () => {
    expect(listCanonical("/c/care", 1)).toBe("/c/care");
    expect(listCanonical("/c/care", 3)).toBe("/c/care/page/3");
    expect(listCanonical("/search", 3)).toBe("/search");
  });

  it("list metadata: canonical, description and noindex for search", () => {
    const meta = listMetadata({
      title: "عناية وعطور",
      description: "وصف",
      basePath: "/c/care",
      page: 2,
    });
    expect(meta.alternates?.canonical).toBe("/c/care/page/2");
    expect(meta.robots).toBeUndefined();
    const search = listMetadata({
      title: "البحث",
      description: "",
      basePath: "/search",
      page: 1,
      index: false,
    });
    expect(search.robots).toEqual({ index: false, follow: true });
  });

  it("a blank description falls back to the title and the site description", () => {
    for (const description of ["", "   "]) {
      const meta = listMetadata({
        title: "عناية وعطور",
        description,
        basePath: "/c/care",
        page: 1,
      });
      expect(meta.description).toMatch(/^عناية وعطور \| \S/);
    }
    const product = productMetadata({ ...lipstick, description: "" });
    expect(product.description).toBe("أحمر شفاه مخملي");
  });

  it("product metadata uses the main image (large) and the canonical path", () => {
    const meta = productMetadata(lipstick);
    expect(meta.title).toBe("أحمر شفاه مخملي");
    expect(meta.alternates?.canonical).toBe("/p/demo-velvet-lipstick");
    expect(JSON.stringify(meta.openGraph)).toContain(
      "products/1/main_large.webp",
    );
  });
});

describe("JSON-LD", () => {
  it("variable product: backend-selected Offer", () => {
    const data = productJsonLd(lipstick);
    expect(data["@type"]).toBe("Product");
    expect(data.brand).toEqual({ "@type": "Brand", name: "لُمى" });
    expect(data.offers).toMatchObject({
      "@type": "Offer",
      priceCurrency: "SYP",
      availability: "https://schema.org/InStock",
    });
    expect(data.url).toBe(`${SITE}/p/demo-velvet-lipstick`);
  });

  it("simple product: Offer with price and availability", () => {
    expect(productJsonLd(mist).offers).toMatchObject({
      "@type": "Offer",
      price: "4.95",
      priceCurrency: "SYP",
      availability: "https://schema.org/OutOfStock",
    });
  });

  it("breadcrumb list with absolute URLs", () => {
    expect(
      breadcrumbJsonLd([
        { name: "الرئيسية", path: "/" },
        { name: "عطور", path: "/c/perfumes" },
      ]).itemListElement,
    ).toEqual([
      { "@type": "ListItem", position: 1, name: "الرئيسية", item: `${SITE}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "عطور",
        item: `${SITE}/c/perfumes`,
      },
    ]);
  });
});

describe("active filter chips", () => {
  const facets: Facets = {
    brands: [{ slug: "demo-ward", name: "وَرد", count: 2 }],
    prices: [{ currency: "SYP", min: "2950", max: "19950" }],
    attributes: [
      { key: "skin_type", label: "نوع البشرة", type: "select", values: [] },
    ],
    options: [{ key: "size", label: "الحجم", type: "select", values: [] }],
  };

  it("labels every active filter from the facets (in_stock is no filter any more)", () => {
    const filters = parseFilters(
      new URLSearchParams(
        "brand=demo-ward&attr.skin_type=جافة&opt.size=50 ml&max_price=4999&in_stock=true",
      ),
      { kind: "category", slug: "care" },
    );
    expect(filterChips(filters, facets).map((c) => c.label)).toEqual([
      "السعر: أقل من 5,000 ل.س",
      "نوع البشرة: جافة",
      "وَرد",
      "الحجم: 50 ml",
    ]);
  });
});
