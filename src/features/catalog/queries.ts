/**
 * catalog: server-side reads.
 * Backend: GET /categories, /categories/{slug}, /brands, /brands/{slug}, /products, /products/facets, /products/{slug}, /products/{slug}/related
 *
 * Belongs here: async functions that read through `publicApi` (anonymous, cacheable
 * with "use cache") or `getApi()` (sends the visitor's token; render inside <Suspense>)
 * from "@/lib/api/client", unwrap the result and return the types from ./types.
 * Server-only: never import this file from a client component.
 *
 * Cache lifetimes follow the backend's own TTLs (README "What is cached"): products 45 s,
 * categories and brands 300 s. Tags allow on-demand revalidation later. Failures are
 * cached for about a second only (see `settle()` in src/lib/api/result.ts).
 */
import "server-only";

import { cacheTag } from "next/cache";

import { pageTimeout, publicApi, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/errors";
import {
  safeDetail,
  safeQuery,
  settle,
  type CacheLifetime,
  type DetailResult,
  type Loaded,
  type QueryResult,
} from "@/lib/api/result";

import {
  backendQuery,
  dropParam,
  parseFilters,
  serializeFilters,
  type ListFilters,
  type ListScope,
} from "./filters";

import type {
  Brand,
  CategoryDetail,
  CategoryNode,
  Facets,
  ImageUrls,
  ProductCard,
  ProductCardPage,
  ProductDetail,
} from "./types";

const RAIL_SIZE = 12;

const PRODUCTS_LIFE: CacheLifetime = { stale: 45, revalidate: 45, expire: 600 };
const TAXONOMY_LIFE: CacheLifetime = {
  stale: 300,
  revalidate: 300,
  expire: 3600,
};

async function loadNewArrivals(): Promise<Loaded<ProductCard[]>> {
  "use cache";
  cacheTag("products");
  return settle(PRODUCTS_LIFE, async () => {
    const page = await unwrap(
      publicApi.GET("/products", {
        params: {
          query: { is_new: true, sort: "newest", page_size: RAIL_SIZE },
        },
        signal: pageTimeout(),
      }),
    );
    return page.items;
  });
}

async function loadOnSale(): Promise<Loaded<ProductCard[]>> {
  "use cache";
  cacheTag("products");
  return settle(PRODUCTS_LIFE, async () => {
    const page = await unwrap(
      publicApi.GET("/products", {
        params: { query: { on_sale: true, page_size: RAIL_SIZE } },
        signal: pageTimeout(),
      }),
    );
    return page.items;
  });
}

export type CategoryTile = {
  id: number;
  name: string;
  slug: string;
  /** The category's own image, else the first product image of the category. */
  image: ImageUrls | null;
};

/** First product image of a category; a failure here only loses the picture. */
async function firstProductImage(category: string): Promise<ImageUrls | null> {
  try {
    const page = await unwrap(
      publicApi.GET("/products", {
        params: { query: { category, page_size: 1 } },
        signal: pageTimeout(),
      }),
    );
    return page.items[0]?.image ?? null;
  } catch {
    return null;
  }
}

async function loadCategoryTiles(): Promise<Loaded<CategoryTile[]>> {
  "use cache";
  cacheTag("categories", "products");
  return settle(TAXONOMY_LIFE, async () => {
    const tree: CategoryNode[] = await unwrap(
      publicApi.GET("/categories", { signal: pageTimeout() }),
    );
    const visible = tree.filter((category) => category.product_count > 0);
    return Promise.all(
      visible.map(async (category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        image: category.image ?? (await firstProductImage(category.slug)),
      })),
    );
  });
}

async function loadBrands(): Promise<Loaded<Brand[]>> {
  "use cache";
  cacheTag("brands");
  return settle(TAXONOMY_LIFE, () =>
    unwrap(publicApi.GET("/brands", { signal: pageTimeout() })),
  );
}

const noItems = (items: readonly unknown[]): boolean => items.length === 0;

/** Newest products flagged "new" (home rail "وصل حديثًا"). */
export function getNewArrivals(): Promise<QueryResult<ProductCard[]>> {
  return safeQuery("new-arrivals", loadNewArrivals, noItems);
}

/** Products on sale (home rail "عروض لفترة محدودة"). */
export function getOnSale(): Promise<QueryResult<ProductCard[]>> {
  return safeQuery("on-sale", loadOnSale, noItems);
}

/** Top-level categories that have products, each with a cover image. */
export function getCategoryTiles(): Promise<QueryResult<CategoryTile[]>> {
  return safeQuery("categories", loadCategoryTiles, noItems);
}

/** Visible brands with their logos. */
export function getBrands(): Promise<QueryResult<Brand[]>> {
  return safeQuery("brands", loadBrands, noItems);
}

// ------------------------------------------------------------------------------------
// Catalog pages (phase 2): lists, facets, details, related, sitemap
// ------------------------------------------------------------------------------------

const DETAIL_LIFE: CacheLifetime = {
  stale: 120,
  revalidate: 120,
  expire: 3600,
};
const SITEMAP_LIFE: CacheLifetime = {
  stale: 3600,
  revalidate: 3600,
  expire: 86400,
};
const MAX_FILTER_RETRIES = 3;

function scopeTags(scope: ListScope): string[] {
  if (scope.kind === "category") return [`category:${scope.slug}`];
  if (scope.kind === "brand") return [`brand:${scope.slug}`];
  return [];
}

/** The rejected parameter of a `422 INVALID_FILTER` (details.param), if that is the error. */
function invalidParam(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== "INVALID_FILTER")
    return null;
  const details = error.details;
  if (details && typeof details === "object" && "param" in details) {
    const param = (details as { param: unknown }).param;
    return typeof param === "string" && param ? param : null;
  }
  return null;
}

/** A backend 404 becomes `null` (not found); every other failure is thrown. */
async function orNull<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Runs a list or facets request. A parameter the backend rejects (INVALID_FILTER) is
 * dropped and the request retried, so a bad URL still renders a page.
 */
async function withFilterRetry<T>(
  filters: ListFilters,
  request: (filters: ListFilters) => Promise<T>,
): Promise<{ data: T; filters: ListFilters; ignored: string[] }> {
  let current = filters;
  const ignored: string[] = [];
  for (let attempt = 0; ; attempt++) {
    try {
      return { data: await request(current), filters: current, ignored };
    } catch (error) {
      const param = invalidParam(error);
      if (!param || attempt >= MAX_FILTER_RETRIES) throw error;
      ignored.push(param);
      current = dropParam(current, param);
    }
  }
}

export type ProductListData = {
  page: ProductCardPage;
  /** The filters actually applied (without the ignored ones). */
  filters: ListFilters;
  /** Parameters the backend rejected (INVALID_FILTER), dropped from the request. */
  ignored: string[];
};

async function loadProductList(
  scope: ListScope,
  query: string,
): Promise<Loaded<ProductListData>> {
  "use cache";
  cacheTag("products", ...scopeTags(scope));
  return settle(PRODUCTS_LIFE, async () => {
    const result = await withFilterRetry(
      parseFilters(new URLSearchParams(query), scope),
      (filters) =>
        unwrap(
          publicApi.GET("/products", {
            querySerializer: () => backendQuery(scope, filters),
            signal: pageTimeout(),
          }),
        ),
    );
    return {
      page: result.data,
      filters: result.filters,
      ignored: result.ignored,
    };
  });
}

export type FacetsData = { facets: Facets; ignored: string[] };

async function loadFacets(
  scope: ListScope,
  query: string,
): Promise<Loaded<FacetsData>> {
  "use cache";
  cacheTag("products", ...scopeTags(scope));
  return settle(PRODUCTS_LIFE, async () => {
    const result = await withFilterRetry(
      parseFilters(new URLSearchParams(query), scope),
      (filters) =>
        unwrap(
          publicApi.GET("/products/facets", {
            querySerializer: () => backendQuery(scope, filters, true),
            signal: pageTimeout(),
          }),
        ),
    );
    return { facets: result.data, ignored: result.ignored };
  });
}

/**
 * Products of a list page. Always `ok` when the backend answers (also with 0 items: the
 * page decides between "no products here" and "no products with these filters").
 * `filters` must be normalized (`parseFilters`), so equivalent URLs share a cache entry.
 */
export function getProductList(
  scope: ListScope,
  filters: ListFilters,
): Promise<QueryResult<ProductListData>> {
  return safeQuery(
    "product-list",
    () => loadProductList(scope, serializeFilters(filters)),
    () => false,
  );
}

/** Filter counts for a list page (brands and price always; attributes for a category). */
export function getFacets(
  scope: ListScope,
  filters: ListFilters,
): Promise<QueryResult<FacetsData>> {
  return safeQuery(
    "facets",
    () => loadFacets(scope, serializeFilters(filters)),
    () => false,
  );
}

async function loadCategory(
  slug: string,
): Promise<Loaded<CategoryDetail | null>> {
  "use cache";
  cacheTag("categories", `category:${slug}`);
  return settle(TAXONOMY_LIFE, () =>
    orNull(() =>
      unwrap(
        publicApi.GET("/categories/{slug}", {
          params: { path: { slug } },
          signal: pageTimeout(),
        }),
      ),
    ),
  );
}

/** A visible category with breadcrumb, children and filterable definitions. */
export function getCategory(
  slug: string,
): Promise<DetailResult<CategoryDetail>> {
  return safeDetail("category", () => loadCategory(slug));
}

async function loadBrand(slug: string): Promise<Loaded<Brand | null>> {
  "use cache";
  cacheTag("brands", `brand:${slug}`);
  return settle(TAXONOMY_LIFE, () =>
    orNull(() =>
      unwrap(
        publicApi.GET("/brands/{slug}", {
          params: { path: { slug } },
          signal: pageTimeout(),
        }),
      ),
    ),
  );
}

export function getBrand(slug: string): Promise<DetailResult<Brand>> {
  return safeDetail("brand", () => loadBrand(slug));
}

async function loadProduct(
  slug: string,
): Promise<Loaded<ProductDetail | null>> {
  "use cache";
  cacheTag("products", `product:${slug}`);
  return settle(DETAIL_LIFE, () =>
    orNull(() =>
      unwrap(
        publicApi.GET("/products/{slug}", {
          params: { path: { slug } },
          signal: pageTimeout(),
        }),
      ),
    ),
  );
}

/** Product detail (variants, images, attributes, bundle items). */
export function getProduct(slug: string): Promise<DetailResult<ProductDetail>> {
  return safeDetail("product", () => loadProduct(slug));
}

async function loadRelated(slug: string): Promise<Loaded<ProductCard[]>> {
  "use cache";
  cacheTag("products", `product:${slug}`);
  return settle(DETAIL_LIFE, async () => {
    const items = await orNull(() =>
      unwrap(
        publicApi.GET("/products/{slug}/related", {
          params: { path: { slug }, query: { limit: RAIL_SIZE } },
          signal: pageTimeout(),
        }),
      ),
    );
    return items ?? [];
  });
}

/** Related products: in-stock products of the same category. */
export function getRelated(slug: string): Promise<QueryResult<ProductCard[]>> {
  return safeQuery("related", () => loadRelated(slug), noItems);
}

export type CatalogIndex = {
  /** Slugs with their visible product counts (list pages 2+ come from the counts). */
  categories: { slug: string; count: number }[];
  brands: { slug: string; count: number }[];
  products: { slug: string }[];
  /** Product counts of the "new" and "sale" lists. */
  newCount: number;
  saleCount: number;
};

/** Bounds for the sitemap and static params: 50 pages × 100 products. */
const SITEMAP_PAGE_SIZE = 100;
const SITEMAP_MAX_PAGES = 50;

async function loadCatalogIndex(): Promise<Loaded<CatalogIndex>> {
  "use cache";
  cacheTag("categories", "brands", "products");
  return settle(SITEMAP_LIFE, async () => {
    const total = (query: { is_new?: boolean; on_sale?: boolean }) =>
      unwrap(
        publicApi.GET("/products", {
          params: { query: { ...query, page_size: 1 } },
          signal: pageTimeout(),
        }),
      ).then((page) => page.total);
    const [tree, brands, newCount, saleCount] = await Promise.all([
      unwrap(publicApi.GET("/categories", { signal: pageTimeout() })),
      unwrap(publicApi.GET("/brands", { signal: pageTimeout() })),
      total({ is_new: true }),
      total({ on_sale: true }),
    ]);
    const categories: CatalogIndex["categories"] = [];
    const walk = (nodes: CategoryNode[]) => {
      for (const node of nodes) {
        categories.push({ slug: node.slug, count: node.product_count });
        walk(node.children);
      }
    };
    walk(tree);
    const products: { slug: string }[] = [];
    for (let page = 1; page <= SITEMAP_MAX_PAGES; page++) {
      const result = await unwrap(
        publicApi.GET("/products", {
          params: { query: { page, page_size: SITEMAP_PAGE_SIZE } },
          signal: pageTimeout(),
        }),
      );
      products.push(...result.items.map((item) => ({ slug: item.slug })));
      if (page * SITEMAP_PAGE_SIZE >= result.total) break;
    }
    return {
      categories,
      brands: brands.map((brand) => ({
        slug: brand.slug,
        count: brand.product_count,
      })),
      products,
      newCount,
      saleCount,
    };
  });
}

/** Every visible category, brand and product slug (bounded): sitemap and static params. */
export function getCatalogIndex(): Promise<QueryResult<CatalogIndex>> {
  return safeQuery("catalog-index", loadCatalogIndex, () => false);
}
