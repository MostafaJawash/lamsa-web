import type { Page } from "@playwright/test";

import {
  BackendError,
  call,
  PASSWORD,
  registerViaApi,
  uniquePhone,
  type TokenPair,
} from "./backend";
import type { Accounts } from "./fixtures";
import { adminToken, product } from "./shop";

/**
 * Checkout, orders and addresses helpers. Customers are throwaway `e2e-…` accounts made
 * through the API (deleted by the `accounts` fixture, which also cancels their orders
 * first so the stock they took is returned); the site itself is driven through the UI.
 */

export type Customer = {
  national: string;
  e164: string;
  token: string;
  name: string;
};

export type ApiAddress = {
  id: number;
  label: string | null;
  governorate: string;
  area: string | null;
  details: string;
  latitude: string | null;
  longitude: string | null;
  is_default: boolean;
};

export type ApiOrder = {
  id: number;
  status: string;
  status_label: string;
  can_cancel: boolean;
  customer_notes: string | null;
  gift_message: string | null;
  payment_method: string;
  delivery: { code: string; name: string; fee_paid_to_carrier: boolean };
  shipping_address: Record<string, unknown> | null;
  items: { name: string; quantity: number; currency: string }[];
  totals: {
    currency: string;
    subtotal: string;
    shipping_fee: string;
    total: string;
  }[];
  timeline: {
    status: string;
    reached_at: string | null;
    is_current: boolean;
  }[];
};

export const DAMASCUS = {
  governorate: "damascus",
  area: "المزة",
  details: "شارع الجلاء، بناء 12، الطابق 3",
  latitude: "33.513800",
  longitude: "36.276500",
  label: "البيت",
};

export const ALEPPO = {
  governorate: "aleppo",
  details: "حي الفرقان قرب الحديقة العامة",
  label: "العمل",
};

export const COURIER = "damascus_courier";
export const PROVINCE = "province_shipping";

/** A simple SYP product and a variable USD product of the demo catalog. */
export const SYP_PRODUCT = "demo-oily-hair-shampoo";
export const SYP_PRODUCT_2 = "demo-moisturizing-conditioner";
export const USD_PRODUCT = "demo-jasmine-night-perfume";

export async function customer(
  accounts: Accounts,
  label = "co",
): Promise<Customer> {
  const phone = uniquePhone();
  accounts.phone(phone.e164);
  const name = `e2e-${label}-${Date.now()}`;
  const pair: TokenPair = await registerViaApi(name, phone.e164);
  accounts.token(phone.e164, pair.access_token);
  return { ...phone, token: pair.access_token, name };
}

/**
 * Creates an address through the API. The backend can answer a rare 500 (a MySQL deadlock,
 * 1213, between concurrent address inserts of different users, which it does not retry
 * for addresses as it does for cart and checkout), so setup retries like a customer would.
 */
export async function addAddress(
  token: string,
  data: Record<string, unknown>,
): Promise<ApiAddress> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call<ApiAddress>("POST", "/users/me/addresses", {
        token,
        body: data,
      });
    } catch (error) {
      const transient = error instanceof BackendError && error.status >= 500;
      if (!transient || attempt >= 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
}

export function addresses(token: string): Promise<ApiAddress[]> {
  return call<ApiAddress[]>("GET", "/users/me/addresses", { token });
}

/** Puts a demo product (by slug) in the customer's stored cart; variable products take their first in-stock variant. */
export async function addToCart(
  token: string,
  slug: string,
  quantity = 1,
): Promise<{ productId: number; variantId: number | null }> {
  const detail = await product(slug);
  const variant = detail.variants.find((v) => v.stock_status !== "out");
  await call("POST", "/cart/items", {
    token,
    body: {
      product_id: detail.id,
      variant_id: detail.type === "variable" ? (variant?.id ?? null) : null,
      quantity,
    },
  });
  return { productId: detail.id, variantId: variant?.id ?? null };
}

export type Quote = {
  code: string;
  name: string;
  description: string | null;
  fee: string;
  fee_paid_to_carrier: boolean;
  totals: { currency: string; amount: string }[];
};
export type CartForQuote = {
  subtotals: { currency: string; amount: string }[];
  delivery_quotes: Quote[];
};

/** What the backend quotes for a governorate (the methods valid there). */
export function quotes(token: string, governorate: string) {
  return call<CartForQuote>("GET", `/cart?governorate=${governorate}`, {
    token,
  });
}

/** The `{currency: amount}` map a customer would confirm for a method. */
export async function expectedTotals(
  token: string,
  governorate: string,
  method: string,
): Promise<Record<string, string>> {
  const cart = await quotes(token, governorate);
  const quote = cart.delivery_quotes.find((q) => q.code === method);
  if (!quote) throw new Error(`no ${method} quote for ${governorate}`);
  return Object.fromEntries(quote.totals.map((t) => [t.currency, t.amount]));
}

export function placeOrderViaApi(
  accounts: Accounts,
  token: string,
  addressId: number,
  method: string,
  totals: Record<string, string>,
  key = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
): Promise<ApiOrder> {
  return call<ApiOrder>("POST", "/orders", {
    token,
    body: {
      delivery_method_code: method,
      address_id: addressId,
      expected_totals: totals,
    },
    headers: { "Idempotency-Key": key },
  }).then((order) => {
    accounts.order(order.id);
    return order;
  });
}

/** Adds a cart line, then places a pending order through the API (a quick way to have orders). */
export async function makeOrder(
  accounts: Accounts,
  who: Customer,
  addressId: number,
  governorate = "aleppo",
  slug = SYP_PRODUCT,
): Promise<ApiOrder> {
  await addToCart(who.token, slug, 1);
  const method = governorate === "damascus" ? COURIER : PROVINCE;
  const totals = await expectedTotals(who.token, governorate, method);
  return placeOrderViaApi(accounts, who.token, addressId, method, totals);
}

export function orderOf(token: string, id: number): Promise<ApiOrder> {
  return call<ApiOrder>("GET", `/orders/${id}`, { token });
}

export function ordersOf(token: string, query = "") {
  return call<{ items: { id: number; status: string }[]; total: number }>(
    "GET",
    `/orders?page_size=100${query}`,
    { token },
  );
}

/** The store moves an order forward (admin API): pending → preparing → shipped → delivered. */
export async function adminStatus(id: number, to: string): Promise<void> {
  await call("POST", `/admin/orders/${id}/status`, {
    token: await adminToken(),
    body: { to_status: to },
  });
}

/** Cancels as the store, returning the stock (used by cleanup). */
export async function adminCancel(id: number): Promise<void> {
  await call("POST", `/admin/orders/${id}/cancel`, {
    token: await adminToken(),
    body: { reason: "e2e cleanup", restore_stock: true },
  });
}

/** Raises a product's stock to at least `minimum` (never lowers it). */
export async function ensureStock(slug: string, minimum: number) {
  const detail = await product(slug);
  const { setStock, adminProduct } = await import("./shop");
  const current = await adminProduct(detail.id);
  if (detail.type === "variable") {
    for (const variant of current.variants)
      if (variant.stock < minimum)
        await setStock(detail.id, minimum, variant.id);
  } else if ((current.stock ?? 0) < minimum) {
    await setStock(detail.id, minimum);
  }
}

/** Logs in through the site's own form (country code +963 is the default). */
export async function signIn(page: Page, who: Customer, next = "/") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page
    .locator(".lm-auth button[type=submit].primary:visible")
    .waitFor({ state: "visible" });
  await page.waitForFunction(
    () =>
      !document
        .querySelector<HTMLButtonElement>(
          ".lm-auth button[type=submit].primary",
        )
        ?.hasAttribute("disabled"),
  );
  await page.locator('[data-field="phone"]:visible').fill(who.national);
  await page.locator('[data-field="password"]:visible').fill(PASSWORD);
  await page.locator(".lm-auth button[type=submit].primary:visible").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30_000,
  });
}

export { call };
