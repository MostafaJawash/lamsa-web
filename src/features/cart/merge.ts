import "server-only";

import { cookies } from "next/headers";

import { getApi, unwrap, type ApiClient } from "@/lib/api/client";

import { flashToast, mergeFlash, type Flash } from "./flash";
import type { GuestCartItem, GuestFavorite } from "./guest-codec";
import {
  clearGuestData,
  GUEST_MAX_AGE,
  guestCookieOptions,
  MERGE_RETRY_COOKIE,
  readGuestCart,
  readGuestFavorites,
  setFlash,
} from "./guest-store";

/**
 * Guest cart and favorites → the account, right after login, register, Google and
 * complete-profile (POST /favorites/merge, then POST /cart/merge). Favorites first:
 * merging them twice is harmless, so a failed cart merge can simply be retried.
 * Throws when the backend fails; the caller keeps the cookies.
 */
export async function mergeGuestData(
  api: ApiClient,
  cart: readonly GuestCartItem[],
  favorites: readonly GuestFavorite[],
): Promise<Flash> {
  if (favorites.length > 0)
    await unwrap(
      api.POST("/favorites/merge", {
        body: { product_ids: favorites.map((f) => f.productId) },
      }),
    );
  if (cart.length === 0) return { kind: "merge", restored: 0, adjusted: false };
  const merged = await unwrap(
    api.POST("/cart/merge", {
      body: {
        items: cart.map((i) => ({
          product_id: i.productId,
          variant_id: i.variantId,
          quantity: i.quantity,
        })),
      },
    }),
  );
  return mergeFlash(merged.merge_report);
}

/**
 * Server actions, after the session cookies are set. Never blocks the sign-in: on a
 * failure the cookies stay and a marker asks the proxy to retry once on the next page.
 */
export async function mergeAfterSignIn(accessToken: string): Promise<void> {
  const [cart, favorites] = await Promise.all([
    readGuestCart(),
    readGuestFavorites(),
  ]);
  if (cart.length === 0 && favorites.length === 0) return;
  try {
    const flash = await mergeGuestData(
      await getApi({ accessToken }),
      cart,
      favorites,
    );
    await clearGuestData();
    if (flashToast(flash)) await setFlash(flash);
  } catch (error) {
    console.error(
      `[lamsa] guest merge failed, retrying on the next page: ${String(error)}`,
    );
    (await cookies()).set(
      MERGE_RETRY_COOKIE,
      "1",
      guestCookieOptions(GUEST_MAX_AGE),
    );
  }
}
