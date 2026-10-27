import "server-only";

import { guestLimits } from "@/config/site";

import {
  cartKey,
  cartQuantity,
  setCartQuantity,
  type GuestCartItem,
} from "./guest-codec";
import { readGuestCart, writeGuestCart } from "./guest-store";
import { cartError, cartErrorFrom, guestLineError } from "./lines";
import { previewGuestCart } from "./queries";
import type { AnyCart, CartActionResult } from "./types";

/** Shared by the cart actions and "move to cart" in favorites (not a server action). */
export type AddInput = {
  productId: number;
  variantId: number | null;
  quantity: number;
  slug: string;
};

export function guestResult(
  cart: AnyCart,
  items: readonly GuestCartItem[],
): CartActionResult {
  return { ok: true, cart, counts: { cart: cartQuantity(items) } };
}

/** Guest add: the preview of the cart WITH the new quantity decides, as POST /cart/items would. */
export async function addGuest(input: AddInput): Promise<CartActionResult> {
  const items = await readGuestCart();
  const key = cartKey(input.productId, input.variantId);
  const existing = items.find((i) => cartKey(i.productId, i.variantId) === key);
  if (!existing && items.length >= guestLimits.cartLines)
    return {
      ok: false,
      error: cartError("CART_LIMIT_REACHED", { max: guestLimits.cartLines }),
    };
  const next = setCartQuantity(
    items,
    {
      productId: input.productId,
      variantId: input.variantId,
      slug: input.slug,
    },
    (existing?.quantity ?? 0) + input.quantity,
  );
  let cart: AnyCart;
  try {
    cart = await previewGuestCart(next);
  } catch (error) {
    return { ok: false, error: cartErrorFrom(error) };
  }
  const error = guestLineError(cart, key, input.variantId !== null);
  if (error) return { ok: false, error };
  if (!(await writeGuestCart(next)))
    return {
      ok: false,
      error: cartError("CART_LIMIT_REACHED", { max: items.length }),
    };
  return guestResult(cart, next);
}
