import type { BrowserContext, Page } from "@playwright/test";

import { API, call, loginViaApi, type TokenPair } from "./backend";

/**
 * Cart, favorites and stock helpers. Stock and settings changes go through the admin
 * API with the e2e admin of global-setup.ts; tests that change them live in
 * stock.spec.ts (run alone, after the parallel tests) and restore what they changed.
 */

/** The production e2e server sets cookies like production: `__Host-` names, Secure. */
export const GUEST_CART = "__Host-lamsa_gcart";
export const GUEST_FAVORITES = "__Host-lamsa_gfav";
export const BASE_URL = "http://localhost:3100";
/** Chrome only accepts a Secure (`__Host-`) cookie set for an https URL; localhost is a secure context, so http://localhost:3100 gets it too. */
const COOKIE_URL = "https://localhost:3100";

export type DetailVariant = {
  id: number;
  options: Record<string, string>;
  stock_status: string;
};
export type Detail = {
  id: number;
  slug: string;
  name: string;
  type: string;
  in_stock: boolean;
  stock_status: string | null;
  variants: DetailVariant[];
  category: { slug: string };
  brand: { slug: string } | null;
};

export function product(slug: string): Promise<Detail> {
  return call<Detail>("GET", `/products/${slug}`);
}

/** The card of a product as browsing returns it (lists hide out-of-stock products). */
export async function listed(
  query: Record<string, string>,
): Promise<{ id: number; slug: string }[]> {
  const params = new URLSearchParams({ page_size: "100", ...query });
  const page = await call<{ items: { id: number; slug: string }[] }>(
    "GET",
    `/products?${params}`,
  );
  return page.items;
}

let adminPair: Promise<TokenPair> | null = null;

export function adminToken(): Promise<string> {
  const phone = process.env.E2E_ADMIN_PHONE;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!phone || !password) throw new Error("no e2e admin (global-setup)");
  adminPair ??= loginViaApi(phone, password);
  return adminPair.then((pair) => pair.access_token);
}

type AdminProduct = {
  id: number;
  stock: number | null;
  is_active: boolean;
  variants: { id: number; stock: number; is_active: boolean }[];
};

export async function adminProduct(id: number): Promise<AdminProduct> {
  return call<AdminProduct>("GET", `/admin/products/${id}`, {
    token: await adminToken(),
  });
}

/** Sets the stock of a simple product or a variant (POST …/stock-adjust); returns the old value. */
export async function setStock(
  productId: number,
  stock: number,
  variantId?: number,
): Promise<number> {
  const current = await adminProduct(productId);
  const before = variantId
    ? (current.variants.find((v) => v.id === variantId)?.stock ?? 0)
    : (current.stock ?? 0);
  if (before !== stock) {
    const path = variantId
      ? `/admin/products/${productId}/variants/${variantId}/stock-adjust`
      : `/admin/products/${productId}/stock-adjust`;
    await call("POST", path, {
      token: await adminToken(),
      body: { delta: stock - before, reason: "e2e" },
    });
  }
  return before;
}

export async function setActive(
  productId: number,
  active: boolean,
  variantId?: number,
): Promise<void> {
  const path = variantId
    ? `/admin/products/${productId}/variants/${variantId}`
    : `/admin/products/${productId}`;
  await call("PATCH", path, {
    token: await adminToken(),
    body: { is_active: active },
  });
}

export async function setHideOutOfStock(value: boolean): Promise<void> {
  await call("PATCH", "/admin/settings", {
    token: await adminToken(),
    body: { catalog_hide_out_of_stock: value },
  });
}

function encode(entries: unknown[]): string {
  return `v1.${Buffer.from(JSON.stringify(entries), "utf8").toString("base64url")}`;
}

/** A guest cart cookie: [product id, variant id or 0, quantity, slug]. */
export async function setGuestCart(
  context: BrowserContext,
  entries: [number, number, number, string][] | string,
): Promise<void> {
  await context.addCookies([
    {
      name: GUEST_CART,
      value: typeof entries === "string" ? entries : encode(entries),
      url: COOKIE_URL,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}

export async function setGuestFavorites(
  context: BrowserContext,
  entries: [number, string][] | string,
): Promise<void> {
  await context.addCookies([
    {
      name: GUEST_FAVORITES,
      value: typeof entries === "string" ? entries : encode(entries),
      url: COOKIE_URL,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}

export async function cookieNames(page: Page): Promise<string[]> {
  return (await page.context().cookies()).map((c) => c.name);
}

/** The guest cart as the backend sees it (prices, issues, totals). */
export function previewOf(
  items: { product_id: number; variant_id?: number | null; quantity: number }[],
) {
  return call<{
    subtotal: string;
    items_count: number;
    lines: { key: string; quantity: number; issue: { code: string } | null }[];
  }>("POST", "/cart/preview", { body: { items } });
}

/** "8.95" → "8,95 €", as formatPrice() prints it. */
export function euro(amount: string): string {
  const [whole, fraction] = amount.split(".");
  return `${Number(whole).toLocaleString("de-DE")},${fraction} €`;
}

/** Waits for the product page to hydrate (the add button is a client form). */
export async function addFromProductPage(page: Page, path: string, times = 1) {
  await page.goto(path);
  const add = page.locator(".lm-buy button.primary:visible");
  await add.waitFor();
  await page.waitForLoadState("networkidle");
  for (let i = 0; i < times; i++) {
    await add.click({ timeout: 15_000 }); // a disabled (sold-out) button fails fast
    await page.locator(".lm-toast").first().waitFor();
    await page.waitForLoadState("networkidle");
  }
}

export { API };
