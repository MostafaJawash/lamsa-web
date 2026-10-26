/**
 * auth: backend errors → what the forms show. Pure (no server or client APIs), so the
 * server actions map with it and the tests cover every code. The backend's Arabic
 * message always wins; the local fallback is only for codes without one.
 */
import { ApiError, errorMessage } from "@/lib/errors";

export type AuthField =
  | "name"
  | "phone"
  | "password"
  | "currentPassword"
  | "newPassword"
  | "confirmPassword";

export type FormErrorKind =
  /** A message under the form (INVALID_CREDENTIALS, network, …). */
  | "generic"
  /** TOO_MANY_ATTEMPTS: live countdown, submit disabled until it ends. */
  | "rateLimited"
  /** ALREADY_REGISTERED: with a link to /login. */
  | "alreadyRegistered"
  /** ACCOUNT_DISABLED: with the store's contact. */
  | "disabled"
  /** Google signup token expired: start again at /login. */
  | "signupExpired";

export type FormError = { kind: FormErrorKind; message: string };

export type AuthFailure = {
  ok: false;
  fieldErrors: Partial<Record<AuthField, string>>;
  formError: FormError | null;
  /** Seconds to wait (TOO_MANY_ATTEMPTS). */
  retryAfter: number | null;
};

export type AuthResult = AuthFailure | { ok: true };

export type MapOptions = {
  /** Field of WEAK_PASSWORD / SAME_PASSWORD ("newPassword" on change password). */
  passwordField?: AuthField;
  /** INVALID_CREDENTIALS on a field (current password) instead of the form. */
  credentialsField?: AuthField;
  /** Google signup: TOKEN_EXPIRED / TOKEN_INVALID mean "start again". */
  signup?: boolean;
};

/** Backend field names (VALIDATION_ERROR details) → form fields. */
const BACKEND_FIELDS: Record<string, AuthField> = {
  name: "name",
  phone: "phone",
  password: "password",
  current_password: "currentPassword",
  new_password: "newPassword",
};

export function failure(
  partial: Partial<Omit<AuthFailure, "ok">> = {},
): AuthFailure {
  return {
    ok: false,
    fieldErrors: partial.fieldErrors ?? {},
    formError: partial.formError ?? null,
    retryAfter: partial.retryAfter ?? null,
  };
}

function retryAfterOf(error: ApiError): number | null {
  if (error.retryAfter && error.retryAfter > 0) return error.retryAfter;
  const details = error.details;
  if (typeof details === "object" && details !== null) {
    const value = (details as Record<string, unknown>).retry_after;
    if (typeof value === "number" && value > 0) return Math.ceil(value);
  }
  return null;
}

export function mapAuthError(
  error: unknown,
  options: MapOptions = {},
): AuthFailure {
  const message = errorMessage(error);
  if (!(error instanceof ApiError))
    return failure({ formError: { kind: "generic", message } });
  const passwordField = options.passwordField ?? "password";

  switch (error.code) {
    case "PHONE_TAKEN":
    case "INVALID_PHONE":
      return failure({ fieldErrors: { phone: message } });
    case "WEAK_PASSWORD":
    case "SAME_PASSWORD":
      return failure({ fieldErrors: { [passwordField]: message } });
    case "INVALID_CREDENTIALS":
      return options.credentialsField
        ? failure({ fieldErrors: { [options.credentialsField]: message } })
        : failure({ formError: { kind: "generic", message } });
    case "ALREADY_REGISTERED":
      return failure({ formError: { kind: "alreadyRegistered", message } });
    case "TOO_MANY_ATTEMPTS":
      return failure({
        formError: { kind: "rateLimited", message },
        retryAfter: retryAfterOf(error) ?? 60,
      });
    case "ACCOUNT_DISABLED":
      return failure({ formError: { kind: "disabled", message } });
    case "TOKEN_EXPIRED":
    case "TOKEN_INVALID":
      if (options.signup)
        return failure({ formError: { kind: "signupExpired", message } });
      break;
    case "VALIDATION_ERROR": {
      const fieldErrors: Partial<Record<AuthField, string>> = {};
      for (const detail of error.validationDetails) {
        const field = BACKEND_FIELDS[detail.field];
        if (field && fieldErrors[field] === undefined)
          fieldErrors[field] = detail.message || message;
      }
      return Object.keys(fieldErrors).length > 0
        ? failure({ fieldErrors })
        : failure({ formError: { kind: "generic", message } });
    }
  }
  return failure({ formError: { kind: "generic", message } });
}
