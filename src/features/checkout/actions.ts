"use server";

/**
 * checkout: the form's server action. One action serves the real submit ("تأكيد الطلب")
 * and the no-JavaScript "refresh" button, as a plain form post or as a `useActionState`
 * action. Rules:
 *
 * - Money is never computed here: the order request carries the totals the customer saw
 *   (`expected_totals`, from a hidden field) and the backend compares them with its own.
 * - The Idempotency-Key comes from the attempt id of the rendered page and the confirmed
 *   inputs (attempt.ts), so a double submit or a retry cannot create a second order and
 *   a changed input or a fresh page always gets a new key.
 * - Backend errors follow its codes: see `handleFailure`.
 */
import type { Route } from "next";
import { redirect } from "next/navigation";

import { setFlash } from "@/features/cart/guest-store";
import { unwrap } from "@/lib/api/client";
import { withAccess } from "@/lib/auth/action-session";
import { isUnauthenticated, redirectToLogin } from "@/lib/auth/login-redirect";
import { t } from "@/i18n";
import { ApiError, errorMessage } from "@/lib/errors";
import { putFailure } from "@/lib/form-failure";

import { idempotencyKey, isAttemptId, type AttemptSnapshot } from "./attempt";
import { checkoutHref, type CheckoutNotice } from "./links";
import { parseTotals } from "./totals";

/** Shown by the form after a failed submit; the typed notes survive it. */
export type CheckoutState = {
  message: string;
  notes: string;
  gift: string;
} | null;

const NOTE_MAX = 500;
const METHOD = /^[a-z0-9_]{1,30}$/;
const RETRY_WAIT_MS = 1_000;
const RETRY_WAIT_MAX_MS = 5_000;

function positiveInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Busy, timed out or unreachable: worth one more try with the same key. */
function isTransient(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === "SERVICE_BUSY" ||
      error.code === "TIMEOUT" ||
      error.code === "NETWORK_ERROR")
  );
}

type Placed = { id: number };

/**
 * POST /orders; a transient failure is retried once with the SAME key (the backend
 * returns the order if the first attempt actually went through).
 */
async function postOrder(
  key: string,
  body: {
    delivery_method_code: string;
    address_id: number;
    customer_notes: string | null;
    gift_message: string | null;
    expected_totals: Record<string, string>;
  },
): Promise<Placed> {
  const send = () =>
    withAccess((api) =>
      unwrap(
        api.POST("/orders", {
          params: { header: { "Idempotency-Key": key } },
          body,
        }),
      ),
    );
  try {
    return await send();
  } catch (error) {
    if (!isTransient(error)) throw error;
    const hinted =
      error instanceof ApiError ? (error.retryAfter ?? 0) * 1000 : 0;
    await wait(Math.min(hinted || RETRY_WAIT_MS, RETRY_WAIT_MAX_MS));
    return send();
  }
}

/**
 * Backend failure → the customer's next step:
 *
 * - empty cart, cart issues, not enough stock → /cart (the cart page shows what to fix);
 * - changed totals or prices → back to /checkout with fresh totals, a notice and a new
 *   attempt (a new key), so the customer confirms again;
 * - a delivery method that no longer fits the address → /checkout with fresh methods;
 * - a missing or invalid address → /checkout with a notice (the address form is there);
 * - anything else → the backend's own Arabic message under the form.
 */
async function handleFailure(
  error: unknown,
  selection: { addressId: number; method: string },
  notes: { notes: string; gift: string },
): Promise<NonNullable<CheckoutState>> {
  if (isUnauthenticated(error)) redirectToLogin("/checkout");
  const back = (notice: CheckoutNotice, drop?: "address" | "method") =>
    redirect(
      checkoutHref({
        address: drop === "address" ? null : selection.addressId,
        method: drop ? null : selection.method,
        notes: notes.notes,
        gift: notes.gift,
        notice,
      }) as Route,
    );
  if (error instanceof ApiError) {
    switch (error.code) {
      case "CART_EMPTY":
      case "CART_HAS_ISSUES":
        return redirect("/cart");
      case "INSUFFICIENT_STOCK": {
        const details = error.details;
        const available =
          typeof details === "object" && details !== null
            ? (details as { available?: unknown }).available
            : null;
        await setFlash({
          kind: "error",
          code: "INSUFFICIENT_STOCK",
          n: typeof available === "number" ? available : null,
        });
        return redirect("/cart");
      }
      case "PRICE_CHANGED":
        return back("price");
      case "DELIVERY_METHOD_NOT_AVAILABLE":
      case "DELIVERY_METHOD_NOT_FOUND":
        return back("method", "method");
      case "ADDRESS_REQUIRED":
      case "ADDRESS_NOT_FOUND":
        return back("address", "address");
      case "INVALID_LOCATION":
        return back("location", "address");
    }
  }
  return { message: errorMessage(error), ...notes };
}

/** Where the no-JavaScript "تحديث" button sends the customer: the same page, new selection. */
function refresh(form: FormData): never {
  redirect(
    checkoutHref({
      address: positiveInt(form.get("address_id")),
      method: METHOD.test(text(form, "method")) ? text(form, "method") : null,
      notes: text(form, "customer_notes").slice(0, NOTE_MAX),
      gift: text(form, "gift_message").slice(0, NOTE_MAX),
    }) as Route,
  );
}

/**
 * "تأكيد الطلب" (and the no-JavaScript "تحديث"). A failure with a message is returned to
 * the form when JavaScript posted it (`js=1`); a plain form post is sent back to the
 * checkout page with `?fs=` instead (see lib/form-failure.ts).
 */
export async function placeOrder(
  _previous: CheckoutState,
  form: FormData,
): Promise<CheckoutState> {
  const result = await submit(form);
  if (result && form.get("js") !== "1") {
    const method = text(form, "method");
    const base = checkoutHref({
      address: positiveInt(form.get("address_id")),
      method: METHOD.test(method) ? method : null,
    });
    redirect(
      `${base}${base.includes("?") ? "&" : "?"}fs=${putFailure(result)}` as Route,
    );
  }
  return result;
}

async function submit(form: FormData): Promise<CheckoutState> {
  if (text(form, "intent") === "refresh") refresh(form);

  const notes = text(form, "customer_notes");
  const gift = text(form, "gift_message");
  const typed = { notes, gift };
  const addressId = positiveInt(form.get("address_id"));
  const method = text(form, "method");
  const totals = parseTotals(form.get("expected_totals"));
  const attempt = form.get("attempt");

  if (addressId === null)
    return { message: t("apiErrors.ADDRESS_REQUIRED"), ...typed };
  if (!METHOD.test(method) || totals === null)
    return { message: t("checkout.needMethod"), ...typed };
  if ([...notes.trim()].length > NOTE_MAX || [...gift.trim()].length > NOTE_MAX)
    return { message: t("checkout.notesTooLong", { max: NOTE_MAX }), ...typed };
  if (!isAttemptId(attempt))
    return { message: t("checkout.expired"), ...typed };

  const snapshot: AttemptSnapshot = {
    addressId,
    method,
    notes,
    gift,
    totals,
  };
  let placed: Placed;
  try {
    placed = await postOrder(idempotencyKey(attempt, snapshot), {
      delivery_method_code: method,
      address_id: addressId,
      customer_notes: notes.trim() || null,
      gift_message: gift.trim() || null,
      expected_totals: totals,
    });
  } catch (error) {
    return handleFailure(error, { addressId, method }, typed);
  }
  redirect(`/checkout/success/${placed.id}`);
}
