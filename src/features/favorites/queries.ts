/**
 * favorites: server-side reads.
 * Backend: GET /favorites (logged in), GET /products?ids= (guests: the cookie's ids)
 *
 * Personal data: never cached here, render inside <Suspense>. Server-only.
 */
import "server-only";

import { getApi, pageTimeout, publicApi, unwrap } from "@/lib/api/client";
import { logQueryFailure } from "@/lib/api/result";
import { getSession } from "@/lib/auth/user";
import { readGuestFavorites } from "@/features/cart/guest-store";
import type { ProductCard } from "@/features/catalog/types";

/** GET /products?ids= takes at most 100 ids. */
const IDS_PER_REQUEST = 100;

/** Logged-in favorites per page (the guest page shows all, at most 200). */
export const FAVORITES_PAGE_SIZE = 24;

/**
 * Visible products among `ids` (out-of-stock ones included), in that order: one
 * request per 100 ids, in parallel. The backend caches each list.
 */
export async function productsByIds(
  ids: readonly number[],
  signal?: AbortSignal,
): Promise<ProductCard[]> {
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST)
    chunks.push(ids.slice(i, i + IDS_PER_REQUEST));
  const pages = await Promise.all(
    chunks.map((chunk) =>
      unwrap(
        publicApi.GET("/products", {
          params: {
            query: { ids: chunk.join(","), page_size: IDS_PER_REQUEST },
          },
          signal,
        }),
      ),
    ),
  );
  return pages.flatMap((page) => page.items);
}

export type FavoritesPageData =
  | {
      status: "ok";
      mode: "user" | "guest";
      items: ProductCard[];
      total: number;
      page: number;
      pageSize: number;
    }
  | { status: "unavailable" };

/** The /favorites page: newest favorite first (both modes). */
export async function getFavoritesPage(
  page: number,
): Promise<FavoritesPageData> {
  const session = await getSession();
  if (session.status === "unavailable") return { status: "unavailable" };
  try {
    if (session.status === "user") {
      const api = await getApi();
      const data = await unwrap(
        api.GET("/favorites", {
          params: { query: { page, page_size: FAVORITES_PAGE_SIZE } },
          signal: pageTimeout(),
        }),
      );
      return {
        status: "ok",
        mode: "user",
        items: data.items,
        total: data.total,
        page: data.page,
        pageSize: FAVORITES_PAGE_SIZE,
      };
    }
    const ids = (await readGuestFavorites()).map((f) => f.productId).reverse();
    const items = await productsByIds(ids, pageTimeout());
    return {
      status: "ok",
      mode: "guest",
      items,
      total: items.length,
      page: 1,
      pageSize: Math.max(items.length, 1),
    };
  } catch (error) {
    logQueryFailure("favorites", String(error));
    return { status: "unavailable" };
  }
}
