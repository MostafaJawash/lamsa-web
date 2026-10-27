import { t, tOptional } from "@/i18n";
import { ApiError, errorMessage, fallbackMessage } from "@/lib/errors";

import type {
  AnyCart,
  AnyCartLine,
  CartError,
  CartNotice,
  DeliveryQuote,
  LineIssue,
} from "./types";

/**
 * Pure cart helpers shared by the server actions and the cart view. No rule is
 * computed here: prices, stock, issues and totals always come from the backend.
 */

/** "<product_id>:<variant_id or 0>" for any line (stored cart or preview). */
export function lineKey(line: AnyCartLine): string {
  return `${line.product.id}:${line.variant?.id ?? 0}`;
}

/** What the actions get to address a line: the database id, or the preview key. */
export function lineRef(line: AnyCartLine): string {
  return "id" in line ? String(line.id) : line.key;
}

/** The text under a line with an issue (prototype `.err`). */
export function issueText(issue: LineIssue): string {
  const n = issue.available ?? issue.max ?? 0;
  return tOptional(`cart.issues.${issue.code}`, { n }) ?? issue.message ?? "";
}

export function noticeText(notice: CartNotice): string {
  return tOptional(`cart.notices.${notice.code}`) ?? notice.message;
}

/** The "home" delivery quote (the summary's shipping row and free-shipping bar). */
export function homeQuote(cart: AnyCart): DeliveryQuote | null {
  return (
    cart.delivery_quotes.find((q) => q.code === "home") ??
    cart.delivery_quotes.find((q) => q.requires_address) ??
    null
  );
}

function detailNumber(details: unknown, key: string): number | null {
  if (typeof details !== "object" || details === null) return null;
  const value = (details as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

/** A failed cart or favorites call, in the shape every UI uses. */
export function cartErrorFrom(error: unknown): CartError {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: errorMessage(error),
      available: detailNumber(error.details, "available"),
      max: detailNumber(error.details, "max"),
    };
  }
  return {
    code: "UNKNOWN_ERROR",
    message: errorMessage(error),
    available: null,
    max: null,
  };
}

/** A cart error built here (guest flows), with the local fallback text. */
export function cartError(
  code: string,
  numbers: { available?: number | null; max?: number | null } = {},
): CartError {
  return {
    code,
    message: fallbackMessage(code) ?? t("errors.generic"),
    available: numbers.available ?? null,
    max: numbers.max ?? null,
  };
}

/**
 * What the customer reads for an add/update error (INSUFFICIENT_STOCK),
 * "الحد الأقصى 10" (QUANTITY_LIMIT_EXCEEDED), otherwise the backend's message.
 */
export function cartErrorText(error: CartError): string {
  if (error.code === "INSUFFICIENT_STOCK" && error.available !== null)
    return t("toast.low", { n: error.available });
  if (error.code === "QUANTITY_LIMIT_EXCEEDED" && error.max !== null)
    return t("toast.max", { n: error.max });
  return error.message;
}

/**
 * Guest add or update: the preview of the cart WITH the change decides, exactly like
 * POST /cart/items would for a stored cart. The error for the target line, or null.
 */
export function guestLineError(
  cart: AnyCart,
  key: string,
  variantGiven: boolean,
): CartError | null {
  const line = cart.lines.find((l) => lineKey(l) === key);
  const issue = line?.issue;
  if (!line) return cartError("PRODUCT_NOT_FOUND");
  if (!issue) return null;
  switch (issue.code) {
    case "UNAVAILABLE":
      return cartError("PRODUCT_NOT_FOUND");
    case "VARIANT_UNAVAILABLE":
      return cartError(variantGiven ? "VARIANT_NOT_FOUND" : "VARIANT_REQUIRED");
    case "OUT_OF_STOCK":
      return cartError("OUT_OF_STOCK");
    case "INSUFFICIENT_STOCK":
      return cartError("INSUFFICIENT_STOCK", { available: issue.available });
    case "QUANTITY_LIMIT_EXCEEDED":
      return cartError("QUANTITY_LIMIT_EXCEEDED", { max: issue.max });
    default:
      return cartError("UNKNOWN_ERROR");
  }
}

/**
 * "تحديث السلة" for a guest cart: what POST /cart/resolve-issues does to a stored cart
 * (backend REMOVABLE_ISSUES), read from the preview's line issues.
 */
export function guestFixes(cart: AnyCart): {
  remove: string[];
  cap: Map<string, number>;
  notices: CartNotice["code"][];
} {
  const remove: string[] = [];
  const cap = new Map<string, number>();
  const notices: CartNotice["code"][] = [];
  for (const line of cart.lines) {
    const issue = line.issue;
    if (!issue) continue;
    if (
      issue.code === "UNAVAILABLE" ||
      issue.code === "VARIANT_UNAVAILABLE" ||
      issue.code === "OUT_OF_STOCK"
    ) {
      remove.push(lineKey(line));
      notices.push("LINE_REMOVED");
      continue;
    }
    const allowed = Math.min(
      issue.available ?? line.quantity,
      issue.max ?? line.quantity,
    );
    if (allowed <= 0) {
      remove.push(lineKey(line));
      notices.push("LINE_REMOVED");
    } else {
      cap.set(lineKey(line), allowed);
      notices.push("QUANTITY_CAPPED");
    }
  }
  return { remove, cap, notices };
}
