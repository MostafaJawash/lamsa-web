"use server";

/**
 * orders: server actions for an order's page. Cancelling works only while the backend says
 * the order is pending (`can_cancel`); anything else comes back as its own message and the
 * page is refreshed from the backend. Reorder puts the order's items back into the cart
 * with the backend's cart-merge rules and reports what was added, adjusted or skipped.
 * Both work as plain form posts (no JavaScript) and from the client controls.
 */
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { mergeFlash } from "@/features/cart/flash";
import { setFlash } from "@/features/cart/guest-store";
import { unwrap } from "@/lib/api/client";
import { withAccess } from "@/lib/auth/action-session";
import { isUnauthenticated, redirectToLogin } from "@/lib/auth/login-redirect";
import { ApiError, errorMessage } from "@/lib/errors";

/** A flash toast for a backend failure: its code, or a generic one (see flash.ts). */
async function flashFailure(error: unknown): Promise<void> {
  const code =
    error instanceof ApiError && /^[A-Z][A-Z_]{1,40}$/.test(error.code)
      ? error.code
      : "INTERNAL_ERROR";
  await setFlash({ kind: "error", code, n: null });
}

export type CancelState = { message: string } | null;

export type ReorderResult =
  | {
      ok: true;
      /** The statuses of the merge report (added, merged, capped, skipped). */
      report: string[];
      cartCount: number;
    }
  | { ok: false; message: string };

function orderId(form: FormData): number | null {
  const value = form.get("id");
  return typeof value === "string" &&
    /^\d{1,9}$/.test(value) &&
    Number(value) > 0
    ? Number(value)
    : null;
}

/** "تأكيد الإلغاء": cancels a pending order, with an optional reason (up to 255 characters). */
export async function cancelOrder(
  _previous: CancelState,
  form: FormData,
): Promise<CancelState> {
  const id = orderId(form);
  const path = id ? `/account/orders/${id}` : "/account/orders";
  if (id === null) return { message: errorMessage(null) };
  const reason = String(form.get("reason") ?? "").trim();
  if ([...reason].length > 255) return { message: errorMessage(null) };
  try {
    await withAccess((api) =>
      unwrap(
        api.POST("/orders/{order_id}/cancel", {
          params: { path: { order_id: id } },
          body: { reason: reason || null },
        }),
      ),
    );
  } catch (error) {
    if (isUnauthenticated(error)) redirectToLogin(path);
    // Not cancellable any more (the store moved it on): say so, and show the real state.
    // From the client the message comes back to the dialog's toast (the backend's own
    // text); a plain form post gets the flash toast (the fallback text of the code).
    if (form.get("js") !== "1") await flashFailure(error);
    revalidatePath(path);
    return { message: errorMessage(error) };
  }
  await setFlash({ kind: "orderCancelled" });
  redirect(path as Route);
}

/** The cancel form's action without JavaScript (the result is the redirect and its toast). */
export async function cancelOrderForm(form: FormData): Promise<void> {
  await cancelOrder(null, form);
}

/**
 * "إعادة الطلب". From the client (`js=1`) it returns the result for the toast; as a plain
 * form post it sets the same toast and goes to the cart.
 */
export async function reorderOrder(form: FormData): Promise<ReorderResult> {
  const id = orderId(form);
  const path = id ? `/account/orders/${id}` : "/account/orders";
  const fromScript = form.get("js") === "1";
  let result: ReorderResult;
  try {
    if (id === null) throw new Error("bad order id");
    const merged = await withAccess((api) =>
      unwrap(
        api.POST("/orders/{order_id}/reorder", {
          params: { path: { order_id: id } },
        }),
      ),
    );
    result = {
      ok: true,
      report: merged.merge_report.map((item) => item.status),
      cartCount: merged.items_count,
    };
  } catch (error) {
    if (isUnauthenticated(error)) redirectToLogin(path);
    result = { ok: false, message: errorMessage(error) };
  }
  if (fromScript) return result;
  if (result.ok) {
    await setFlash(mergeFlash(result.report.map((status) => ({ status }))));
    redirect("/cart");
  }
  await flashFailure(null);
  redirect(path as Route);
}

/** The reorder button's form action without JavaScript. */
export async function reorderOrderForm(form: FormData): Promise<void> {
  form.delete("js");
  await reorderOrder(form);
}
