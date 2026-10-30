/**
 * checkout: server-side reads.
 * Backend: GET /users/me/addresses, GET /governorates, GET /cart?governorate=&delivery_method_code=
 *
 * Everything is personal and fresh per request. The backend decides which delivery methods
 * are valid for the selected address (`delivery_quotes`, filtered by governorate) and what
 * each one adds to which currency bucket; nothing about Damascus or the provinces is
 * decided here. Server-only.
 */
import "server-only";

import type { Address, Governorate } from "@/features/account/types";
import { getAddresses, getGovernorates } from "@/features/account/queries";
import type { Cart, DeliveryQuote } from "@/features/cart/types";
import { getApi, pageTimeout, unwrap } from "@/lib/api/client";
import { logQueryFailure } from "@/lib/api/result";

export type CheckoutSelection = {
  /** `?address=`: the address the customer picked (the default one when absent). */
  addressId: number | null;
  /** `?method=`: the delivery method code the customer picked. */
  method: string | null;
};

export type CheckoutData =
  | { status: "unavailable" }
  /** Empty cart, or a cart with issues: back to /cart, which shows what to fix. */
  | { status: "cart" }
  | {
      status: "ok";
      cart: Cart;
      addresses: Address[];
      governorates: Governorate[];
      address: Address | null;
      quotes: DeliveryQuote[];
      /** The picked method, or the only valid one; null when the customer must choose. */
      quote: DeliveryQuote | null;
    };

export function pickAddress(
  addresses: readonly Address[],
  wanted: number | null,
): Address | null {
  return (
    addresses.find((address) => address.id === wanted) ??
    addresses.find((address) => address.is_default) ??
    addresses[0] ??
    null
  );
}

/** The picked method if it is valid for the address, else the only valid one, else null. */
export function pickQuote(
  quotes: readonly DeliveryQuote[],
  wanted: string | null,
): DeliveryQuote | null {
  return (
    quotes.find((quote) => quote.code === wanted) ??
    (quotes.length === 1 ? (quotes[0] ?? null) : null)
  );
}

export async function getCheckoutData(
  selection: CheckoutSelection,
): Promise<CheckoutData> {
  try {
    const api = await getApi();
    const [addressesResult, governorates] = await Promise.all([
      getAddresses(),
      getGovernorates(),
    ]);
    if (addressesResult.status === "unavailable")
      return { status: "unavailable" };
    const addresses = addressesResult.addresses;
    const address = pickAddress(addresses, selection.addressId);
    const cart = await unwrap(
      api.GET("/cart", {
        params: {
          query: address ? { governorate: address.governorate } : {},
        },
        signal: pageTimeout(),
      }),
    );
    if (cart.lines.length === 0 || !cart.can_checkout)
      return { status: "cart" };
    // Without an address there is nothing to deliver to yet: no methods are offered.
    const quotes = address ? cart.delivery_quotes : [];
    return {
      status: "ok",
      cart,
      addresses,
      governorates: governorates.status === "ok" ? governorates.data : [],
      address,
      quotes,
      quote: pickQuote(quotes, selection.method),
    };
  } catch (error) {
    logQueryFailure("checkout", String(error));
    return { status: "unavailable" };
  }
}
