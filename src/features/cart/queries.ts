/**
 * cart: server-side reads.
 * Backend: GET /cart, GET /cart/count, POST /cart/preview (guests), GET /favorites/ids
 *
 * Personal data: never cached, render inside <Suspense>. Server-only.
 */
import "server-only";

import { cache } from "react";

import { getApi, pageTimeout, publicApi, unwrap } from "@/lib/api/client";
import { logQueryFailure } from "@/lib/api/result";
import { getSession } from "@/lib/auth/user";

import { cartQuantity, type GuestCartItem } from "./guest-codec";
import { readGuestCart, readGuestFavorites } from "./guest-store";
import type { AnyCart, CartPreview, Counts } from "./types";

/** The guest cart as the backend computes it (prices, stock, issues, totals). */
export async function previewGuestCart(
  items: readonly GuestCartItem[],
  signal?: AbortSignal,
): Promise<CartPreview> {
  return unwrap(
    publicApi.POST("/cart/preview", {
      body: {
        items: items.map((i) => ({
          product_id: i.productId,
          variant_id: i.variantId,
          quantity: i.quantity,
        })),
      },
      signal,
    }),
  );
}

export type CartPageData =
  | { status: "ok"; mode: "user" | "guest"; cart: AnyCart }
  | { status: "unavailable" };

/** The /cart page: the stored cart, or the guest cookie's preview. */
export async function getCartPage(): Promise<CartPageData> {
  const session = await getSession();
  if (session.status === "unavailable") return { status: "unavailable" };
  try {
    if (session.status === "user") {
      const api = await getApi();
      const cart = await unwrap(api.GET("/cart", { signal: pageTimeout() }));
      return { status: "ok", mode: "user", cart };
    }
    const items = await readGuestCart();
    const cart = await previewGuestCart(items, pageTimeout());
    return { status: "ok", mode: "guest", cart };
  } catch (error) {
    logQueryFailure("cart", String(error));
    return { status: "unavailable" };
  }
}

/**
 * Badge numbers for this request (React cache: the header and the tabbar share one
 * read). Logged in: GET /cart/count and GET /favorites/ids; guests: the cookies (no
 * backend call). null when the backend can't be asked (no badge then).
 */
export const getBadgeCounts = cache(
  async (): Promise<Required<Counts> | null> => {
    const session = await getSession();
    if (session.status === "unavailable") return null;
    if (session.status === "guest") {
      const [cart, favorites] = await Promise.all([
        readGuestCart(),
        readGuestFavorites(),
      ]);
      return { cart: cartQuantity(cart), favorites: favorites.length };
    }
    try {
      const api = await getApi();
      const [count, ids] = await Promise.all([
        unwrap(api.GET("/cart/count", { signal: pageTimeout() })),
        unwrap(api.GET("/favorites/ids", { signal: pageTimeout() })),
      ]);
      return { cart: count.items_count, favorites: ids.product_ids.length };
    } catch (error) {
      logQueryFailure("badges", String(error));
      return null;
    }
  },
);
