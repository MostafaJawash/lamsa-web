import { describe, expect, it } from "vitest";

import {
  activeFilters,
  backendQuery,
  cleared,
  dropParam,
  effectiveSort,
  hrefWith,
  laterPages,
  pageFromSegment,
  pagedPath,
  parseFilters,
  pricePreset,
  serializeFilters,
  setValue,
  toggle,
  withPage,
  withPricePreset,
  type ListScope,
} from "@/features/catalog/filters";

const CARE: ListScope = { kind: "category", slug: "care" };
const parse = (query: string, scope: ListScope = CARE) =>
  parseFilters(new URLSearchParams(query), scope);

describe("parseFilters / serializeFilters (normalization)", () => {
  it("sorts names and values and removes duplicates, so equivalent URLs match", () => {
    const a = parse("brand=b&brand=a&attr.skin_type=جافة&brand=a");
    const b = parse("attr.skin_type=جافة&brand=a&brand=b");
    expect(serializeFilters(a)).toBe(serializeFilters(b));
    expect(a).toEqual([
      ["attr.skin_type", "جافة"],
      ["brand", "a"],
      ["brand", "b"],
    ]);
  });

  it("drops empty, unknown and malformed parameters", () => {
    expect(
      parse(
        "brand=&foo=1&min_price=abc&max_price=12.5&sort=cheap&page=0&in_stock=yes&attr.Bad=x&opt.size=50 ml",
      ),
    ).toEqual([
      ["max_price", "12.5"],
      ["opt.size", "50 ml"],
    ]);
  });

  it("keeps one value for single-valued names (the last wins) and drops page=1", () => {
    expect(parse("sort=newest&sort=price_asc&page=1")).toEqual([
      ["sort", "price_asc"],
    ]);
    expect(parse("page=3")).toEqual([["page", "3"]]);
  });

  it("accepts attribute ranges and booleans with the backend names", () => {
    expect(
      parse("attr.volume.min=30&attr.volume.max=100&attr.vegan=true"),
    ).toEqual([
      ["attr.vegan", "true"],
      ["attr.volume.max", "100"],
      ["attr.volume.min", "30"],
    ]);
    expect(parse("attr.volume.min=lots")).toEqual([]);
  });

  it("ignores the parameters a scope fixes, and q/relevance outside search", () => {
    expect(parse("brand=x&on_sale=true", { kind: "brand", slug: "x" })).toEqual(
      [["on_sale", "true"]],
    );
    expect(parse("on_sale=true", { kind: "sale" })).toEqual([]);
    expect(parse("q=عطر&sort=relevance")).toEqual([]);
    expect(parse("q=عطر&sort=relevance", { kind: "search" })).toEqual([
      ["q", "عطر"],
      ["sort", "relevance"],
    ]);
  });

  it("maps the no-JS price select to min/max", () => {
    expect(parse("price=lt5")).toEqual([["max_price", "4999"]]);
    expect(parse("price=5to15&min_price=1")).toEqual([
      ["max_price", "14999"],
      ["min_price", "5000"],
    ]);
    expect(parse("price=gt15")).toEqual([["min_price", "15000"]]);
    expect(parse("price=nonsense&min_price=2")).toEqual([["min_price", "2"]]);
  });

  it("accepts the Next.js searchParams object", () => {
    expect(
      parseFilters({ brand: ["b", "a"], page: "2", empty: undefined }, CARE),
    ).toEqual([
      ["brand", "a"],
      ["brand", "b"],
      ["page", "2"],
    ]);
  });

  it("serializes with encoding and builds hrefs", () => {
    const filters = parse("attr.skin_type=جافة&brand=demo-ward");
    expect(serializeFilters(filters)).toBe(
      `attr.skin_type=${encodeURIComponent("جافة")}&brand=demo-ward`,
    );
    expect(hrefWith("/c/care", [])).toBe("/c/care");
  });

  it("puts the page in the path, except on search", () => {
    const filters = parse("brand=demo-ward&page=2");
    expect(hrefWith("/c/care", filters)).toBe("/c/care/page/2?brand=demo-ward");
    expect(hrefWith("/new", parse("page=3"))).toBe("/new/page/3");
    expect(hrefWith("/new", parse("page=1"))).toBe("/new");
    const search = parse("q=x&page=2", { kind: "search" });
    expect(hrefWith("/search", search)).toBe("/search?page=2&q=x");
    expect(pagedPath("/brands/baity", 4)).toBe("/brands/baity/page/4");
    expect(pagedPath("/brands/baity", 1)).toBe("/brands/baity");
  });
});

describe("filter changes", () => {
  it("toggle adds and removes one value and resets the page", () => {
    const start = parse("brand=a&page=3");
    const added = toggle(start, "brand", "b", CARE);
    expect(added).toEqual([
      ["brand", "a"],
      ["brand", "b"],
    ]);
    expect(toggle(added, "brand", "a", CARE)).toEqual([["brand", "b"]]);
  });

  it("setValue replaces every value; null removes", () => {
    const start = parse("attr.skin_type=a&attr.skin_type=b");
    expect(setValue(start, "attr.skin_type", "c", CARE)).toEqual([
      ["attr.skin_type", "c"],
    ]);
    expect(setValue(start, "attr.skin_type", null, CARE)).toEqual([]);
  });

  it("withPage sets or removes the page", () => {
    expect(withPage(parse("brand=a"), 2, CARE)).toEqual([
      ["brand", "a"],
      ["page", "2"],
    ]);
    expect(withPage(parse("brand=a&page=2"), 1, CARE)).toEqual([
      ["brand", "a"],
    ]);
  });

  it("cleared keeps only q and sort", () => {
    const search: ListScope = { kind: "search" };
    expect(
      cleared(parse("q=x&sort=price_asc&brand=a&page=2", search), search),
    ).toEqual([
      ["q", "x"],
      ["sort", "price_asc"],
    ]);
  });

  it("activeFilters excludes q, sort and page", () => {
    expect(
      activeFilters(
        parse("q=x&sort=newest&page=2&brand=a", { kind: "search" }),
      ),
    ).toEqual([["brand", "a"]]);
  });
});

describe("price ranges", () => {
  it("recognizes presets and custom ranges", () => {
    expect(pricePreset(parse("max_price=4999"))).toBe("lt5");
    expect(pricePreset(parse("min_price=5000&max_price=14999"))).toBe("5to15");
    expect(pricePreset(parse("min_price=15000"))).toBe("gt15");
    expect(pricePreset(parse("min_price=3&max_price=9"))).toBe("custom");
    expect(pricePreset(parse("brand=a"))).toBeNull();
  });

  it("withPricePreset replaces min/max", () => {
    expect(withPricePreset(parse("min_price=1&brand=a"), "gt15", CARE)).toEqual(
      [
        ["brand", "a"],
        ["min_price", "15000"],
      ],
    );
    expect(withPricePreset(parse("max_price=4999"), null, CARE)).toEqual([]);
  });
});

describe("backend query", () => {
  it("adds the scope's fixed parameters and the page size, sorted", () => {
    expect(backendQuery(CARE, parse("brand=a&page=2"))).toBe(
      "brand=a&category=care&page=2&page_size=24",
    );
    expect(backendQuery({ kind: "sale" }, [])).toBe(
      "on_sale=true&page_size=24",
    );
    expect(backendQuery({ kind: "new" }, parse("sort=price_asc"), true)).toBe(
      "is_new=true",
    );
  });

  it("dropParam removes a rejected parameter and its .min/.max", () => {
    expect(
      dropParam(
        parse("attr.volume.min=1&attr.volume=2&brand=a"),
        "attr.volume",
      ),
    ).toEqual([["brand", "a"]]);
  });

  it("effectiveSort: relevance with q, newest otherwise", () => {
    expect(effectiveSort(parse("q=x", { kind: "search" }))).toBe("relevance");
    expect(effectiveSort(parse(""))).toBe("newest");
    expect(effectiveSort(parse("sort=price_desc"))).toBe("price_desc");
  });

  it("pageFromSegment accepts 2..9999 only", () => {
    expect(pageFromSegment("2")).toBe(2);
    expect(pageFromSegment("9999")).toBe(9999);
    for (const bad of ["1", "0", "02", "10000", "x", "", "2.5"])
      expect(pageFromSegment(bad)).toBeNull();
  });

  it("laterPages lists pages 2..last, bounded", () => {
    expect(laterPages(24)).toEqual([]);
    expect(laterPages(25)).toEqual([2]);
    expect(laterPages(73)).toEqual([2, 3, 4]);
    expect(laterPages(10_000)).toHaveLength(10);
  });
});
