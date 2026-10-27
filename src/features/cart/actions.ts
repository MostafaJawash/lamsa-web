"use server";

/**
 * cart: server actions. Logged in: the backend cart (POST/PATCH/DELETE /cart…) through
 * withAccess(); guests: the cart cookie, validated and rendered by POST /cart/preview,
 * so every rule stays in the backend. Each returns a CartActionResult (the new cart and
 * the badge count) for the client, or, for forms posted without JavaScript (no `js`
 * field), redirects back with a flash toast.
 */
import type { Route } from "next";
import { redirect } from "next/navigation";

import { withAccess, freshAccessToken } from "@/lib/auth/action-session";
import { unwrap } from "@/lib/api/client";
import { safeNext } from "@/lib/auth/next-param";

import type { Flash } from "./flash";
import {
  cartKey,
  cartQuantity,
  parseCartKey,
  removeCartLine,
  setCartQuantity,
} from "./guest-codec";
import { readGuestCart, setFlash, writeGuestCart } from "./guest-store";
import {
  cartError,
  cartErrorFrom,
  guestFixes,
  guestLineError,
  noticeText,
} from "./lines";
import { previewGuestCart } from "./queries";
import { addGuest, guestResult, type AddInput } from "./guest-cart";
import type { AnyCart, CartActionResult } from "./types";
import { guestLimits } from "@/config/site";
import { t } from "@/i18n";

function positiveInt(
  value: FormDataEntryValue | null | undefined,
): number | null {
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}

function text(value: FormDataEntryValue | null, max = 200): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** Called by the client (js=1) or by a plain form post (redirect back with a flash). */
function fromScript(form: FormData): boolean {
  return form.get("js") === "1";
}

async function finishWithoutScript(
  form: FormData,
  result: CartActionResult,
  success: Flash | null,
  fallback: string,
): Promise<never> {
  if (!result.ok)
    await setFlash({
      kind: "error",
      code: /^[A-Z_]{2,40}$/.test(result.error.code)
        ? result.error.code
        : "UNKNOWN_ERROR",
      n: result.error.available ?? result.error.max,
    });
  else if (success) await setFlash(success);
  redirect(safeNext(text(form.get("next"), 2048) || fallback) as Route);
}

function userResult(cart: AnyCart): CartActionResult {
  return { ok: true, cart, counts: { cart: cart.items_count } };
}

async function signedIn(): Promise<boolean> {
  return (await freshAccessToken()) !== null;
}

// ------------------------------------------------------------------------------- add

async function addUser(input: AddInput): Promise<CartActionResult> {
  try {
    const cart = await withAccess((api) =>
      unwrap(
        api.POST("/cart/items", {
          body: {
            product_id: input.productId,
            variant_id: input.variantId,
            quantity: input.quantity,
          },
        }),
      ),
    );
    return userResult(cart);
  } catch (error) {
    return { ok: false, error: cartErrorFrom(error) };
  }
}

/**
 * The product page's add button (form fields: product_id, variant_id, quantity, slug,
 * next, js). Pending state and the toast are the client's; this only adds.
 */
export async function addToCart(form: FormData): Promise<CartActionResult> {
  const productId = positiveInt(form.get("product_id"));
  const variantId = positiveInt(form.get("variant_id"));
  const quantity = Math.min(
    positiveInt(form.get("quantity")) ?? 1,
    guestLimits.maxQuantity,
  );
  const slug = text(form.get("slug"));
  const result: CartActionResult =
    productId === null
      ? { ok: false, error: cartError("PRODUCT_NOT_FOUND") }
      : (await signedIn())
        ? await addUser({ productId, variantId, quantity, slug })
        : await addGuest({ productId, variantId, quantity, slug });
  if (!fromScript(form))
    return finishWithoutScript(form, result, { kind: "cartAdded" }, "/");
  return result;
}

// ---------------------------------------------------------------------- cart page

/**
 * A new quantity for one line (`line`: the stored line's id, or the guest preview key).
 * Errors leave the cart unchanged and say why (INSUFFICIENT_STOCK with `available`).
 */
export async function updateLine(input: {
  line: string;
  quantity: number;
}): Promise<CartActionResult> {
  const quantity = Math.trunc(Number(input.quantity));
  if (
    !Number.isFinite(quantity) ||
    quantity < 1 ||
    quantity > guestLimits.maxQuantity
  )
    return { ok: false, error: cartError("VALIDATION_ERROR") };
  if (await signedIn()) {
    const id = positiveInt(String(input.line));
    if (id === null)
      return { ok: false, error: cartError("CART_ITEM_NOT_FOUND") };
    try {
      const cart = await withAccess((api) =>
        unwrap(
          api.PATCH("/cart/items/{item_id}", {
            params: { path: { item_id: id } },
            body: { quantity },
          }),
        ),
      );
      return userResult(cart);
    } catch (error) {
      return { ok: false, error: cartErrorFrom(error) };
    }
  }
  const parsed = parseCartKey(input.line);
  const items = await readGuestCart();
  const current = parsed
    ? items.find((i) => cartKey(i.productId, i.variantId) === input.line)
    : undefined;
  if (!parsed || !current)
    return { ok: false, error: cartError("CART_ITEM_NOT_FOUND") };
  const next = setCartQuantity(items, current, quantity);
  let cart: AnyCart;
  try {
    cart = await previewGuestCart(next);
  } catch (error) {
    return { ok: false, error: cartErrorFrom(error) };
  }
  // Going down is always allowed (it may fix an issue); going up must be valid.
  const error =
    quantity > current.quantity
      ? guestLineError(cart, input.line, current.variantId !== null)
      : null;
  if (error) return { ok: false, error };
  await writeGuestCart(next);
  return guestResult(cart, next);
}

/** The line's remove button (`.l-rm`), a form that also works without JavaScript. */
export async function removeLine(form: FormData): Promise<CartActionResult> {
  const line = text(form.get("line"), 40);
  let result: CartActionResult;
  if (await signedIn()) {
    const id = positiveInt(line);
    try {
      if (id === null) throw new Error("bad line id");
      const cart = await withAccess((api) =>
        unwrap(
          api.DELETE("/cart/items/{item_id}", {
            params: { path: { item_id: id } },
          }),
        ),
      );
      result = userResult(cart);
    } catch (error) {
      result = { ok: false, error: cartErrorFrom(error) };
    }
  } else {
    const items = removeCartLine(await readGuestCart(), line);
    await writeGuestCart(items);
    try {
      result = guestResult(await previewGuestCart(items), items);
    } catch (error) {
      result = {
        ok: false,
        error: cartErrorFrom(error),
        counts: { cart: cartQuantity(items) },
      };
    }
  }
  if (!fromScript(form))
    return finishWithoutScript(form, result, null, "/cart");
  return result;
}

/** "إفراغ السلة" (after the confirmation dialog). */
export async function clearCart(): Promise<CartActionResult> {
  if (await signedIn()) {
    try {
      return userResult(await withAccess((api) => unwrap(api.DELETE("/cart"))));
    } catch (error) {
      return { ok: false, error: cartErrorFrom(error) };
    }
  }
  await writeGuestCart([]);
  try {
    return guestResult(await previewGuestCart([]), []);
  } catch (error) {
    return { ok: false, error: cartErrorFrom(error), counts: { cart: 0 } };
  }
}

/**
 * "حدّث سلتي": logged in, POST /cart/resolve-issues; guests, the same fixes applied to
 * the cookie from the preview's line issues (see lines.ts guestFixes).
 */
export async function resolveIssues(): Promise<CartActionResult> {
  if (await signedIn()) {
    try {
      const cart = await withAccess((api) =>
        unwrap(api.POST("/cart/resolve-issues")),
      );
      return {
        ...userResult(cart),
        notices: cart.notices.map(noticeText),
      } as CartActionResult;
    } catch (error) {
      return { ok: false, error: cartErrorFrom(error) };
    }
  }
  try {
    let items = await readGuestCart();
    const fixes = guestFixes(await previewGuestCart(items));
    for (const key of fixes.remove) items = removeCartLine(items, key);
    items = items.map((i) => {
      const cap = fixes.cap.get(cartKey(i.productId, i.variantId));
      return cap === undefined ? i : { ...i, quantity: cap };
    });
    await writeGuestCart(items);
    const cart = await previewGuestCart(items);
    const notices = fixes.notices.map((code) => t(`cart.notices.${code}`));
    return { ...guestResult(cart, items), notices } as CartActionResult;
  } catch (error) {
    return { ok: false, error: cartErrorFrom(error) };
  }
}

/** The add button's form action without JavaScript (adds, then redirects back). */
export async function addToCartForm(form: FormData): Promise<void> {
  form.delete("js");
  await addToCart(form);
}

/** The remove button's form action without JavaScript (removes, then back to /cart). */
export async function removeLineForm(form: FormData): Promise<void> {
  form.delete("js");
  await removeLine(form);
}
