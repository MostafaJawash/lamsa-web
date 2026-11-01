/**
 * Backend errors of the settings forms → what the forms show. Pure, like
 * address-errors.ts. The backend's Arabic message wins (PHONE_TAKEN, INVALID_PHONE,
 * WEAK_PASSWORD, SAME_PASSWORD, INVALID_CREDENTIALS, ...); only the per-field marks of a
 * VALIDATION_ERROR use our own texts, because the backend's field messages are English.
 */
import { mapAuthError } from "@/features/auth/errors";
import { t } from "@/i18n";
import { ApiError, errorMessage } from "@/lib/errors";

import type { SettingsErrors } from "./settings-validation";

/** The session is gone (not a refused password: INVALID_CREDENTIALS is also a 401). */
export function isSessionGone(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    [
      "NOT_AUTHENTICATED",
      "TOKEN_INVALID",
      "TOKEN_EXPIRED",
      "TOKEN_REUSED",
    ].includes(error.code)
  );
}

function fieldOf(detail: { field: string }): string {
  return detail.field.split(".").pop() ?? "";
}

export function mapProfileError(error: unknown): SettingsErrors {
  if (!(error instanceof ApiError)) return { form: errorMessage(error) };
  if (error.code === "VALIDATION_ERROR") {
    const errors: SettingsErrors = {};
    for (const detail of error.validationDetails) {
      const field = fieldOf(detail);
      if (field === "name" && !errors.name)
        errors.name = t("auth.errors.nameRequired");
      if (field === "email" && !errors.email)
        errors.email = t("settings.errors.emailInvalid");
    }
    if (Object.keys(errors).length > 0) return errors;
  }
  return { form: errorMessage(error) };
}

export function mapPhoneError(error: unknown): SettingsErrors {
  if (!(error instanceof ApiError)) return { form: errorMessage(error) };
  const message = errorMessage(error);
  switch (error.code) {
    case "PHONE_TAKEN":
    case "INVALID_PHONE":
      return { phone: message };
    case "CURRENT_PASSWORD_REQUIRED":
    case "INVALID_CREDENTIALS":
      return { currentPassword: message };
    case "VALIDATION_ERROR":
      return error.validationDetails.some((d) => fieldOf(d) === "phone")
        ? { phone: t("auth.errors.phoneInvalid") }
        : { form: message };
    default:
      return { form: message };
  }
}

export function mapPasswordError(error: unknown): SettingsErrors {
  const failure = mapAuthError(error, {
    passwordField: "newPassword",
    credentialsField: "currentPassword",
  });
  const errors: SettingsErrors = {};
  for (const field of [
    "currentPassword",
    "newPassword",
    "confirmPassword",
  ] as const) {
    const message = failure.fieldErrors[field];
    if (message) errors[field] = message;
  }
  if (failure.formError) errors.form = failure.formError.message;
  return errors;
}
