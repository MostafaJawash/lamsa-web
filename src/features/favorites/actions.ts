"use server";

/**
 * favorites: server actions. Logged in: PUT/DELETE /favorites/{id}, GET /favorites/ids,
 * POST /favorites/{id}/move-to-cart; guests: the favorites cookie (ids validated through
 * GET /products?ids=) and the guest cart (see src/features/cart/guest-cart.ts).
 * Forms posted without JavaScript (no `js` field) redirect back with a flash toast.
 */
import type { Route } from "next";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { guestLimits } from "@/config/site";
import { addGuest } from "@/features/cart/guest-cart";
import {
  readGuestFavorites,
  setFlash,
  writeGuestFavorites,
} from "@/features/cart/guest-store";
import type { Flash } from "@/features/cart/flash";
import { cartError, cartErrorFrom } from "@/features/cart/lines";
import type { CartActionResult, CartError } from "@/features/cart/types";
import { getProduct } from "@/features/catalog/queries";
import { unwrap, type ApiClient } from "@/lib/api/client";
import { freshAccessToken, withAccess } from "@/lib/auth/action-session";
import { safeNext } from "@/lib/auth/next-param";

import { productsByIds } from "./queries";
import type { FavoriteResult } from "./types";

function productIdOf(form: FormData): number | null {
  const value = form.get("product_id");
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

function nextOf(form: FormData): string {
  const value = form.get("next");
  return safeNext(typeof value === "string" ? value : "/");
}

async function favoriteIds(api: ApiClient): Promise<number[]> {
  return (await unwrap(api.GET("/favorites/ids"))).product_ids;
}

async function finish<T extends { ok: boolean; error?: CartError }>(
  form: FormData,
  result: T,
  success: Flash | null,
): Promise<T> {
  const next = nextOf(form);
  if (form.get("js") === "1") {
    // Logged-in changes set no cookie: refresh the favorites page so the list follows.
    if (result.ok && next.startsWith("/favorites")) refresh();
    return result;
  }
  if (!result.ok && result.error)
    await setFlash({
      kind: "error",
      code: /^[A-Z_]{2,40}$/.test(result.error.code)
        ? result.error.code
        : "UNKNOWN_ERROR",
      n: result.error.max ?? result.error.available,
    });
  else if (success) await setFlash(success);
  redirect(next as Route);
}

/** The hearts' current state for this visitor (one call per page view, client controller). */
export async function getFavoriteState(): Promise<{ ids: number[] } | null> {
  try {
    if ((await freshAccessToken()) !== null)
      return { ids: await withAccess(favoriteIds) };
    return { ids: (await readGuestFavorites()).map((f) => f.productId) };
  } catch {
    return null;
  }
}

async function setUserFavorite(
  productId: number,
  want: boolean | null,
): Promise<FavoriteResult> {
  let on = want ?? false;
  try {
    const ids = await withAccess(async (api) => {
      if (want === null) on = !(await favoriteIds(api)).includes(productId);
      const path = { params: { path: { product_id: productId } } };
      if (on) await unwrap(api.PUT("/favorites/{product_id}", path));
      else await unwrap(api.DELETE("/favorites/{product_id}", path));
      return favoriteIds(api);
    });
    return { ok: true, on, counts: { favorites: ids.length } };
  } catch (error) {
    return { ok: false, on: !on, error: cartErrorFrom(error) };
  }
}

async function setGuestFavorite(
  productId: number,
  want: boolean | null,
  slugHint: string,
): Promise<FavoriteResult> {
  const items = await readGuestFavorites();
  const had = items.some((f) => f.productId === productId);
  const on = want ?? !had;
  if (!on) {
    const next = items.filter((f) => f.productId !== productId);
    await writeGuestFavorites(next);
    return { ok: true, on, counts: { favorites: next.length } };
  }
  if (had) return { ok: true, on, counts: { favorites: items.length } };
  if (items.length >= guestLimits.favorites)
    return {
      ok: false,
      on: false,
      error: cartError("FAVORITES_LIMIT_REACHED", {
        max: guestLimits.favorites,
      }),
    };
  let slug = slugHint;
  try {
    const [card] = await productsByIds([productId]);
    if (!card)
      return { ok: false, on: false, error: cartError("PRODUCT_NOT_FOUND") };
    slug = card.slug;
  } catch (error) {
    return { ok: false, on: false, error: cartErrorFrom(error) };
  }
  const next = [...items, { productId, slug }];
  if (!(await writeGuestFavorites(next)))
    return {
      ok: false,
      on: false,
      error: cartError("FAVORITES_LIMIT_REACHED", { max: items.length }),
    };
  return { ok: true, on, counts: { favorites: next.length } };
}

/**
 * A heart (form fields: product_id, slug, next; the controller adds want=1|0 and js=1).
 * Without `want` it toggles the current state.
 */
export async function toggleFavorite(form: FormData): Promise<FavoriteResult> {
  const productId = productIdOf(form);
  const wantField = form.get("want");
  const want = wantField === "1" ? true : wantField === "0" ? false : null;
  const slug =
    typeof form.get("slug") === "string"
      ? String(form.get("slug")).slice(0, 200)
      : "";
  const result: FavoriteResult =
    productId === null
      ? { ok: false, on: false, error: cartError("PRODUCT_NOT_FOUND") }
      : (await freshAccessToken()) !== null
        ? await setUserFavorite(productId, want)
        : await setGuestFavorite(productId, want, slug);
  return finish(
    form,
    result,
    result.ok ? { kind: result.on ? "favAdded" : "favRemoved" } : null,
  );
}

/** The first active variant in stock of a variable product, from its (cached) detail. */
async function firstVariantInStock(slug: string): Promise<number | null> {
  const detail = await getProduct(slug);
  if (detail.status !== "ok") return null;
  return detail.data.variants.find((v) => v.stock_status !== "out")?.id ?? null;
}

/**
 * "انقل للسلة" on the favorites page: logged in, POST /favorites/{id}/move-to-cart;
 * guests: add to the guest cart (variable products: the first variant in stock), then
 * leave the guest favorites.
 */
export async function moveToCart(form: FormData): Promise<CartActionResult> {
  const productId = productIdOf(form);
  let result: CartActionResult;
  if (productId === null) {
    result = { ok: false, error: cartError("PRODUCT_NOT_FOUND") };
  } else if ((await freshAccessToken()) !== null) {
    try {
      const { cart, ids } = await withAccess(async (api) => {
        const moved = await unwrap(
          api.POST("/favorites/{product_id}/move-to-cart", {
            params: { path: { product_id: productId } },
            body: { quantity: 1 },
          }),
        );
        return { cart: moved, ids: await favoriteIds(api) };
      });
      result = {
        ok: true,
        cart,
        counts: { cart: cart.items_count, favorites: ids.length },
      };
    } catch (error) {
      result = { ok: false, error: cartErrorFrom(error) };
    }
  } else {
    result = await moveGuest(productId);
  }
  return finish(form, result, { kind: "moved" });
}

async function moveGuest(productId: number): Promise<CartActionResult> {
  let card;
  try {
    [card] = await productsByIds([productId]);
  } catch (error) {
    return { ok: false, error: cartErrorFrom(error) };
  }
  if (!card) return { ok: false, error: cartError("PRODUCT_NOT_FOUND") };
  if (!card.in_stock) return { ok: false, error: cartError("OUT_OF_STOCK") };
  let variantId: number | null = null;
  if (card.type === "variable") {
    variantId = await firstVariantInStock(card.slug);
    if (variantId === null)
      return { ok: false, error: cartError("OUT_OF_STOCK") };
  }
  const added = await addGuest({
    productId,
    variantId,
    quantity: 1,
    slug: card.slug,
  });
  if (!added.ok) return added;
  const favorites = (await readGuestFavorites()).filter(
    (f) => f.productId !== productId,
  );
  await writeGuestFavorites(favorites);
  return { ...added, counts: { ...added.counts, favorites: favorites.length } };
}

/** The heart's form action (only runs without JavaScript: toggles, then redirects back). */
export async function toggleFavoriteForm(form: FormData): Promise<void> {
  form.delete("js");
  await toggleFavorite(form);
}

/** "انقل للسلة" as a plain form (without JavaScript: moves, then redirects back). */
export async function moveToCartForm(form: FormData): Promise<void> {
  form.delete("js");
  await moveToCart(form);
}
