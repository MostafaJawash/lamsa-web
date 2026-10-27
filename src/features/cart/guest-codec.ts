import { guestLimits } from "@/config/site";

/**
 * The guest cart and favorites, kept in two httpOnly cookies (only server code reads
 * them, see guest-store.ts). Compact and versioned: `"v1." + base64url(JSON)`.
 *
 * - cart: `[[product_id, variant_id or 0, quantity, product_slug], …]`, at most
 *   `guestLimits.cartLines` lines, quantity 1..`guestLimits.maxQuantity`;
 * - favorites: `[[product_id, product_slug], …]`, oldest first, at most
 *   `guestLimits.favorites`.
 *
 * Nothing here is trusted: prices, stock and visibility always come from the backend
 * (POST /cart/preview, GET /products?ids=). The slug is only a hint for links and
 * lookups. Pure (no cookies, no Node APIs), so it is unit-tested directly.
 */
export const GUEST_COOKIE_VERSION = "v1";

/** Stay under the 4096-byte cookie limit with the name and attributes included. */
export const MAX_COOKIE_BYTES = 3800;

const MAX_SLUG_LENGTH = 200;
const PREFIX = `${GUEST_COOKIE_VERSION}.`;

export type GuestCartItem = {
  productId: number;
  variantId: number | null;
  quantity: number;
  slug: string;
};

export type GuestFavorite = { productId: number; slug: string };

/** `malformed`: the cookie existed but could not be read at all (reset it). */
export type Decoded<T> = { items: T[]; malformed: boolean };

/** "<product_id>:<variant_id or 0>", the backend preview's line key. */
export function cartKey(productId: number, variantId: number | null): string {
  return `${productId}:${variantId ?? 0}`;
}

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function cleanSlug(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_SLUG_LENGTH) return null;
  return /[\u0000-\u001f\u007f]/.test(value) ? null : value;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("not base64url");
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** The JSON array inside a cookie value, or null when it is not one of ours. */
function readArray(raw: string): unknown[] | null {
  if (!raw.startsWith(PREFIX)) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(raw.slice(PREFIX.length)));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function write(value: unknown): string {
  return `${PREFIX}${toBase64Url(JSON.stringify(value))}`;
}

export function decodeCart(
  raw: string | undefined | null,
): Decoded<GuestCartItem> {
  if (!raw) return { items: [], malformed: false };
  const entries = readArray(raw);
  if (!entries) return { items: [], malformed: true };
  const byKey = new Map<string, GuestCartItem>();
  for (const entry of entries) {
    if (!Array.isArray(entry)) continue;
    const [productId, variant, quantity, slug] = entry as unknown[];
    const cleaned = cleanSlug(slug);
    if (!isId(productId) || !(variant === 0 || isId(variant))) continue;
    if (!isId(quantity) || cleaned === null) continue;
    const variantId = variant === 0 ? null : (variant as number);
    const key = cartKey(productId, variantId);
    const existing = byKey.get(key);
    const total = Math.min(
      (existing?.quantity ?? 0) + quantity,
      guestLimits.maxQuantity,
    );
    byKey.set(key, { productId, variantId, quantity: total, slug: cleaned });
  }
  return {
    items: [...byKey.values()].slice(0, guestLimits.cartLines),
    malformed: false,
  };
}

/** The cookie value, or null when it would not fit in a cookie. */
export function encodeCart(items: readonly GuestCartItem[]): string | null {
  const value = write(
    items.map((i) => [i.productId, i.variantId ?? 0, i.quantity, i.slug]),
  );
  return value.length > MAX_COOKIE_BYTES ? null : value;
}

export function decodeFavorites(
  raw: string | undefined | null,
): Decoded<GuestFavorite> {
  if (!raw) return { items: [], malformed: false };
  const entries = readArray(raw);
  if (!entries) return { items: [], malformed: true };
  const byId = new Map<number, GuestFavorite>();
  for (const entry of entries) {
    if (!Array.isArray(entry)) continue;
    const [productId, slug] = entry as unknown[];
    const cleaned = cleanSlug(slug);
    if (!isId(productId) || cleaned === null || byId.has(productId)) continue;
    byId.set(productId, { productId, slug: cleaned });
  }
  // Oldest first: over the limit, the newest are kept.
  return {
    items: [...byId.values()].slice(-guestLimits.favorites),
    malformed: false,
  };
}

/**
 * The cookie value. Too long for a cookie: the slugs of the oldest favorites are dropped
 * (they are only hints) until it fits; null if even the ids alone don't.
 */
export function encodeFavorites(
  items: readonly GuestFavorite[],
): string | null {
  const entries = items.map((i): [number, string] => [i.productId, i.slug]);
  let value = write(entries);
  for (let i = 0; value.length > MAX_COOKIE_BYTES && i < entries.length; i++) {
    const entry = entries[i];
    if (entry) entry[1] = "";
    value = write(entries);
  }
  return value.length > MAX_COOKIE_BYTES ? null : value;
}

/** Total quantity in the guest cart (the badge before the cart page is visited). */
export function cartQuantity(items: readonly GuestCartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/** The cart with (product, variant) set to `quantity` (added at the end when new). */
export function setCartQuantity(
  items: readonly GuestCartItem[],
  item: Omit<GuestCartItem, "quantity">,
  quantity: number,
): GuestCartItem[] {
  const key = cartKey(item.productId, item.variantId);
  const next = Math.min(Math.max(quantity, 1), guestLimits.maxQuantity);
  const found = items.some((i) => cartKey(i.productId, i.variantId) === key);
  if (!found) return [...items, { ...item, quantity: next }];
  return items.map((i) =>
    cartKey(i.productId, i.variantId) === key
      ? { ...i, quantity: next, slug: item.slug || i.slug }
      : i,
  );
}

export function removeCartLine(
  items: readonly GuestCartItem[],
  key: string,
): GuestCartItem[] {
  return items.filter((i) => cartKey(i.productId, i.variantId) !== key);
}

export function parseCartKey(
  key: unknown,
): { productId: number; variantId: number | null } | null {
  if (typeof key !== "string") return null;
  const match = /^(\d{1,15}):(\d{1,15})$/.exec(key);
  if (!match) return null;
  const productId = Number(match[1]);
  const variant = Number(match[2]);
  if (!isId(productId) || !(variant === 0 || isId(variant))) return null;
  return { productId, variantId: variant === 0 ? null : variant };
}
