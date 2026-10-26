import { describe, expect, it, vi } from "vitest";

import {
  catalogRoute,
  createExistenceChecker,
  EXISTS_TTL_MS,
  MISSING_TTL_MS,
  type ExistenceCheck,
} from "@/features/catalog/existence";

const BASE = "http://api.test/api/v1";

const detail = (key: string): ExistenceCheck => ({
  key,
  path: `/products/${key}`,
  list: false,
});

function setup(
  respond: (url: string) => number | "down" | { items: unknown[] },
  maxEntries?: number,
) {
  let clock = 0;
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const answer = respond(String(input));
    if (answer === "down") throw new TypeError("fetch failed");
    return typeof answer === "number"
      ? new Response("{}", { status: answer })
      : Response.json(answer);
  });
  const checker = createExistenceChecker({
    apiBaseUrl: BASE,
    fetcher: fetcher as unknown as typeof fetch,
    now: () => clock,
    maxEntries,
  });
  return {
    checker,
    fetcher,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

const route = (url: string) => {
  const parsed = new URL(url, "http://site.test");
  return catalogRoute(parsed.pathname, parsed.searchParams);
};

describe("createExistenceChecker", () => {
  it("calls the backend path under the API base URL", async () => {
    const { checker, fetcher } = setup(() => 200);
    await checker.check(detail("a"));
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(`${BASE}/products/a`);
  });

  it("maps 200 to exists, 404 to missing and errors to unknown", async () => {
    const { checker } = setup((url) =>
      url.endsWith("/ok") ? 200 : url.endsWith("/nope") ? 404 : 503,
    );
    expect(await checker.check(detail("ok"))).toBe("exists");
    expect(await checker.check(detail("nope"))).toBe("missing");
    expect(await checker.check(detail("boom"))).toBe("unknown");
  });

  it("a list page exists when the backend returns items", async () => {
    const { checker } = setup((url) =>
      url.includes("page=2") ? { items: [1] } : { items: [] },
    );
    const page = (n: number): ExistenceCheck => ({
      key: `p${n}`,
      path: `/products?category=care&page=${n}`,
      list: true,
    });
    expect(await checker.check(page(2))).toBe("exists");
    expect(await checker.check(page(3))).toBe("missing");
  });

  it("passes through when the backend is down, without caching", async () => {
    let down = true;
    const { checker, fetcher } = setup(() => (down ? "down" : 404));
    expect(await checker.check(detail("x"))).toBe("unknown");
    expect(checker.size()).toBe(0);
    down = false;
    expect(await checker.check(detail("x"))).toBe("missing");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps existing slugs for 5 minutes", async () => {
    const { checker, fetcher, advance } = setup(() => 200);
    await checker.check(detail("a"));
    advance(EXISTS_TTL_MS - 1);
    await checker.check(detail("a"));
    expect(fetcher).toHaveBeenCalledTimes(1);
    advance(1);
    await checker.check(detail("a"));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps unknown slugs for 60 seconds", async () => {
    let status = 404;
    const { checker, fetcher, advance } = setup(() => status);
    expect(await checker.check(detail("new"))).toBe("missing");
    status = 200;
    advance(MISSING_TTL_MS - 1);
    expect(await checker.check(detail("new"))).toBe("missing");
    advance(1);
    expect(await checker.check(detail("new"))).toBe("exists");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("evicts the least recently used entry beyond the bound", async () => {
    const { checker, fetcher } = setup(() => 200, 2);
    await checker.check(detail("a"));
    await checker.check(detail("b"));
    await checker.check(detail("a")); // a is now the most recent
    await checker.check(detail("c")); // evicts b
    expect(checker.size()).toBe(2);
    fetcher.mockClear();
    await checker.check(detail("a"));
    expect(fetcher).not.toHaveBeenCalled();
    await checker.check(detail("b"));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("catalogRoute", () => {
  it("checks product, category and brand slugs at their detail endpoints", () => {
    expect(route("/p/demo-velvet-lipstick")).toEqual({
      action: "check",
      check: {
        key: "product:demo-velvet-lipstick",
        path: "/products/demo-velvet-lipstick",
        list: false,
      },
    });
    expect(route("/c/care")).toMatchObject({
      check: { path: "/categories/care" },
    });
    const baity = encodeURIComponent("بيتي");
    expect(route(`/brands/${baity}`)).toMatchObject({
      check: { key: "brand:بيتي", path: `/brands/${baity}` },
    });
  });

  it("checks list pages 2+ against the product list", () => {
    expect(route("/c/care/page/2")).toMatchObject({
      check: {
        path: "/products?category=care&page=2&page_size=24",
        list: true,
      },
    });
    expect(route("/brands/baity/page/3")).toMatchObject({
      check: { path: "/products?brand=baity&page=3&page_size=24" },
    });
    expect(route("/new/page/2")).toMatchObject({
      check: { path: "/products?is_new=true&page=2&page_size=24" },
    });
    expect(route("/sale/page/2")).toMatchObject({
      check: { path: "/products?on_sale=true&page=2&page_size=24" },
    });
  });

  it("redirects ?page and /page/1 to the path form, keeping the filters", () => {
    expect(route("/c/care?brand=a&page=2")).toEqual({
      action: "redirect",
      location: "/c/care/page/2?brand=a",
    });
    expect(route("/new?page=1")).toEqual({
      action: "redirect",
      location: "/new",
    });
    expect(route("/sale?page=x&sort=price_asc")).toEqual({
      action: "redirect",
      location: "/sale?sort=price_asc",
    });
    expect(route("/c/care/page/1?brand=a")).toEqual({
      action: "redirect",
      location: "/c/care?brand=a",
    });
  });

  it("answers 404 for invalid page segments", () => {
    for (const url of [
      "/c/care/page/0",
      "/new/page/x",
      "/sale/page/02",
      "/p/a/page/2",
    ])
      expect(route(url)).toEqual({ action: "not-found" });
  });

  it("ignores other paths and malformed encodings", () => {
    expect(route("/new")).toBeNull();
    expect(route("/brands")).toBeNull();
    expect(route("/p/a/b")).toBeNull();
    expect(route("/account")).toBeNull();
    expect(route("/p/%E0%A4%A")).toBeNull();
  });
});
