import "server-only";

import { cookies } from "next/headers";

import { isProduction } from "@/lib/env";
import type { CookieSpec } from "@/lib/auth/session";

import {
  decodeCart,
  decodeFavorites,
  encodeCart,
  encodeFavorites,
  type GuestCartItem,
  type GuestFavorite,
} from "./guest-codec";
import { encodeFlash, FLASH_COOKIE, FLASH_MAX_AGE, type Flash } from "./flash";

/**
 * Guest cart and favorites cookies (format: guest-codec.ts). httpOnly, SameSite=Lax,
 * path "/", 90 days; in production Secure with the `__Host-` prefix, like the session
 * cookies. Written by server actions and the proxy only, never while rendering.
 */
const prefix = isProduction ? "__Host-" : "";

export const GUEST_CART_COOKIE = `${prefix}lamsa_gcart`;
export const GUEST_FAVORITES_COOKIE = `${prefix}lamsa_gfav`;
/** Set when the merge after login failed: the proxy retries once (see merge.ts). */
export const MERGE_RETRY_COOKIE = `${prefix}lamsa_gmerge`;

export const GUEST_MAX_AGE = 90 * 24 * 60 * 60;

export function guestCookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/" as const,
    maxAge,
  };
}

/** The flash cookie is read by the client controller: NOT httpOnly (codes only). */
export function flashCookieOptions(maxAge = FLASH_MAX_AGE) {
  return {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function clearedGuestCookieSpecs(): CookieSpec[] {
  return [GUEST_CART_COOKIE, GUEST_FAVORITES_COOKIE, MERGE_RETRY_COOKIE].map(
    (name) => ({ name, value: "", options: guestCookieOptions(0) }),
  );
}

const loggedMalformed = new Set<string>();

/** Logs a malformed guest cookie once per process and kind (it is reset on the next write). */
export function logMalformed(kind: "cart" | "favorites"): void {
  if (loggedMalformed.has(kind)) return;
  loggedMalformed.add(kind);
  console.warn(`[lamsa] malformed guest ${kind} cookie: reset`);
}

export async function readGuestCart(): Promise<GuestCartItem[]> {
  const decoded = decodeCart((await cookies()).get(GUEST_CART_COOKIE)?.value);
  if (decoded.malformed) logMalformed("cart");
  return decoded.items;
}

export async function readGuestFavorites(): Promise<GuestFavorite[]> {
  const decoded = decodeFavorites(
    (await cookies()).get(GUEST_FAVORITES_COOKIE)?.value,
  );
  if (decoded.malformed) logMalformed("favorites");
  return decoded.items;
}

/** Server actions only. false: the cart would not fit in a cookie (nothing written). */
export async function writeGuestCart(
  items: readonly GuestCartItem[],
): Promise<boolean> {
  const store = await cookies();
  if (items.length === 0) {
    store.set(GUEST_CART_COOKIE, "", guestCookieOptions(0));
    return true;
  }
  const value = encodeCart(items);
  if (value === null) return false;
  store.set(GUEST_CART_COOKIE, value, guestCookieOptions(GUEST_MAX_AGE));
  return true;
}

export async function writeGuestFavorites(
  items: readonly GuestFavorite[],
): Promise<boolean> {
  const store = await cookies();
  if (items.length === 0) {
    store.set(GUEST_FAVORITES_COOKIE, "", guestCookieOptions(0));
    return true;
  }
  const value = encodeFavorites(items);
  if (value === null) return false;
  store.set(GUEST_FAVORITES_COOKIE, value, guestCookieOptions(GUEST_MAX_AGE));
  return true;
}

export async function clearGuestData(): Promise<void> {
  const store = await cookies();
  for (const spec of clearedGuestCookieSpecs())
    store.set(spec.name, spec.value, spec.options);
}

export async function setFlash(flash: Flash): Promise<void> {
  (await cookies()).set(FLASH_COOKIE, encodeFlash(flash), flashCookieOptions());
}
