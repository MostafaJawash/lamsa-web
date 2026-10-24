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
import {
  safeQuery,
  settle,
  type CacheLifetime,
  type Loaded,
  type QueryResult,
} from "@/lib/api/result";

import type { Brand, CategoryNode, ImageUrls, ProductCard } from "./types";

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

/** Newest products flagged "new" (home rail "وصل حديثاً"). */
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
