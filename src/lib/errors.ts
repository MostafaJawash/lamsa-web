import { t, tOptional } from "@/i18n";

/**
 * Every error code listed in the backend README ("Error format"). The Arabic fallback
 * texts live in messages/ar.json under `apiErrors.<CODE>`; tests check that each code
 * has one. Cart line issue codes (`UNAVAILABLE`, `VARIANT_UNAVAILABLE`, ...) are not
 * errors and belong to the cart feature.
 */
export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "INTERNAL_ERROR",
  "NOT_FOUND",
  "METHOD_NOT_ALLOWED",
  "HTTP_ERROR",
  "NOT_AUTHENTICATED",
  "TOKEN_INVALID",
  "TOKEN_EXPIRED",
  "TOKEN_REUSED",
  "INVALID_CREDENTIALS",
  "TOO_MANY_ATTEMPTS",
  "ACCOUNT_DISABLED",
  "USER_NOT_FOUND",
  "ADMIN_ONLY",
  "PASSWORD_CHANGE_REQUIRED",
  "GOOGLE_TOKEN_INVALID",
  "ALREADY_REGISTERED",
  "INVALID_PHONE",
  "PHONE_TAKEN",
  "WEAK_PASSWORD",
  "SAME_PASSWORD",
  "NOT_A_PASSWORD_ACCOUNT",
  "CURRENT_PASSWORD_REQUIRED",
  "ADDRESS_NOT_FOUND",
  "ADDRESS_LIMIT_REACHED",
  "CANNOT_MODIFY_SELF",
  "CATEGORY_NOT_FOUND",
  "BRAND_NOT_FOUND",
  "PRODUCT_NOT_FOUND",
  "VARIANT_NOT_FOUND",
  "IMAGE_NOT_FOUND",
  "ATTRIBUTE_NOT_FOUND",
  "SLUG_TAKEN",
  "SKU_TAKEN",
  "CATEGORY_NOT_EMPTY",
  "CATEGORY_DEPTH_EXCEEDED",
  "BRAND_HAS_PRODUCTS",
  "ATTRIBUTE_KEY_TAKEN",
  "ATTRIBUTE_IN_USE",
  "OPTION_IN_USE",
  "VARIANT_OPTION_IN_USE",
  "UNKNOWN_ATTRIBUTE",
  "INVALID_ATTRIBUTE_VALUE",
  "MISSING_REQUIRED_ATTRIBUTE",
  "INVALID_VARIANT_OPTIONS",
  "DUPLICATE_VARIANT",
  "PRODUCT_TYPE_IMMUTABLE",
  "INVALID_PRODUCT_FOR_TYPE",
  "PRODUCT_NOT_PUBLISHABLE",
  "PRODUCT_HAS_ORDERS",
  "PRODUCT_IN_BUNDLE",
  "VARIANT_HAS_ORDERS",
  "VARIANT_IN_BUNDLE",
  "INVALID_BUNDLE_ITEM",
  "STOCK_NEGATIVE",
  "IMAGE_LIMIT_REACHED",
  "IMAGE_ORDER_MISMATCH",
  "FILE_TOO_LARGE",
  "INVALID_IMAGE",
  "INVALID_FILTER",
  "CART_ITEM_NOT_FOUND",
  "VARIANT_REQUIRED",
  "VARIANT_NOT_ALLOWED",
  "QUANTITY_LIMIT_EXCEEDED",
  "INSUFFICIENT_STOCK",
  "OUT_OF_STOCK",
  "CART_LIMIT_REACHED",
  "FAVORITES_LIMIT_REACHED",
  "ORDER_NOT_FOUND",
  "CART_EMPTY",
  "CART_HAS_ISSUES",
  "DELIVERY_METHOD_NOT_FOUND",
  "ADDRESS_REQUIRED",
  "PRICE_CHANGED",
  "ORDER_NOT_CANCELLABLE",
  "INVALID_STATUS_TRANSITION",
  "NOTIFICATION_NOT_FOUND",
  "NOTIFICATION_NOT_EDITABLE",
  "INVALID_SCHEDULE",
  "INVALID_LINK",
  "BANNER_NOT_FOUND",
  "SERVICE_BUSY",
  "BANNER_ORDER_MISMATCH",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Codes produced by this app, not by the backend. */
export type ClientErrorCode = "NETWORK_ERROR" | "TIMEOUT" | "UNKNOWN_ERROR";

export type ValidationDetail = { field: string; message: string };

/** The backend's error body: `{"error": {"code", "message", "details"}}`. */
export type ApiErrorBody = {
  error: { code: string; message: string; details: unknown };
};

export class ApiError extends Error {
  override readonly name = "ApiError";

  constructor(
    /** HTTP status; 0 when the request never got a response. */
    readonly status: number,
    /** Backend code (branch on this), or a client code for network failures. */
    readonly code: ApiErrorCode | ClientErrorCode | (string & {}),
    /** The backend's Arabic message, when it sent one. */
    readonly backendMessage: string | null,
    readonly details: unknown = null,
    /** `Retry-After` in seconds (429 / 503), when present. */
    readonly retryAfter: number | null = null,
  ) {
    super(backendMessage ?? code);
  }

  is(code: ApiErrorCode | ClientErrorCode): boolean {
    return this.code === code;
  }

  /** The `{field, message}` list of a `VALIDATION_ERROR`, otherwise empty. */
  get validationDetails(): ValidationDetail[] {
    return this.code === "VALIDATION_ERROR" && Array.isArray(this.details)
      ? this.details.filter(isValidationDetail)
      : [];
  }
}

function isValidationDetail(value: unknown): value is ValidationDetail {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).field === "string" &&
    typeof (value as Record<string, unknown>).message === "string"
  );
}

export function isApiErrorCode(code: string): code is ApiErrorCode {
  return (API_ERROR_CODES as readonly string[]).includes(code);
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value))
    return false;
  const error = (value as { error: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as Record<string, unknown>).code === "string"
  );
}

/** Arabic fallback for a code (`apiErrors.<CODE>` in messages/ar.json), or null. */
export function fallbackMessage(code: string): string | null {
  return tOptional(`apiErrors.${code}`) ?? null;
}

/**
 * The text to show for an error. Prefers the backend's Arabic message, then the local
 * fallback for its code, then a generic message.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.backendMessage?.trim()) return error.backendMessage;
    if (error.code === "NETWORK_ERROR") return t("errors.network");
    if (error.code === "TIMEOUT") return t("errors.timeout");
    return fallbackMessage(error.code) ?? t("errors.generic");
  }
  return t("errors.generic");
}
