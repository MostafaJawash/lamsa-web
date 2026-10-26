/**
 * auth: the form schemas, shared by the client forms (react-hook-form, instant
 * feedback) and the server actions (re-validated there before calling the backend).
 *
 * zod/mini on purpose: these ship to the browser on the auth pages only, and the full
 * zod would add ~60 KB there. The backend stays the authority (it normalizes the phone
 * and re-checks the password rules); these rules mirror it.
 */
import * as z from "zod/mini";

import { phoneCountryCodes, type PhoneCountryCode } from "@/config/site";
import { t } from "@/i18n";

export const NAME_MAX = 100;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
/** The backend accepts up to 32 characters for a phone. */
export const PHONE_MAX = 32;

const ONLY_DIGITS = /^\p{Nd}+$/u;

function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

function isInternational(number: string): boolean {
  const trimmed = number.trim();
  return trimmed.startsWith("+") || trimmed.startsWith("00");
}

/**
 * The number sent to the backend: what the visitor typed when it is already
 * international (+49…, 0049…), otherwise the country code plus the national number
 * without its trunk "0" (all supported countries use 0).
 */
export function combinePhone(countryCode: string, number: string): string {
  if (isInternational(number)) return number.trim();
  return `${countryCode}${digitsOf(number).replace(/^0/, "")}`;
}

/** Spellings of the phone a password must not equal (the backend's rule, approximated). */
export function phoneForms(countryCode: string, number: string): string[] {
  if (!digitsOf(number)) return [];
  const combined = combinePhone(countryCode, number);
  const international = digitsOf(combined.replace(/^00/, ""));
  const code = digitsOf(countryCode);
  const national = international.startsWith(code)
    ? international.slice(code.length)
    : digitsOf(number).replace(/^0/, "");
  // With and without the trunk 0 after the country code (+49 0151…), as the backend's
  // normalizer accepts both.
  return [
    `+${international}`,
    international,
    `00${international}`,
    `+${code}0${national}`,
    `00${code}0${national}`,
    `0${national}`,
    national,
  ];
}

function matchesPhone(password: string, forms: readonly string[]): boolean {
  if (forms.length === 0) return false;
  return forms.includes(password.replace(/[\s\-()./]/g, ""));
}

export type PasswordRule = "length" | "notDigits" | "notPhone";

/** The live hints under a new password: which backend rules it already meets. */
export function passwordRules(
  password: string,
  forms: readonly string[] = [],
): Record<PasswordRule, boolean> {
  return {
    length: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    notDigits: password.length > 0 && !ONLY_DIGITS.test(password),
    notPhone: password.length > 0 && !matchesPhone(password, forms),
  };
}

const name = z
  .string()
  .check(
    z.trim(),
    z.minLength(1, { error: t("auth.errors.nameRequired") }),
    z.maxLength(NAME_MAX, { error: t("auth.errors.nameTooLong") }),
  );

const countryCode = z.enum(
  phoneCountryCodes as unknown as [PhoneCountryCode, ...PhoneCountryCode[]],
);

const phone = z.string().check(
  z.trim(),
  z.minLength(1, { error: t("auth.errors.phoneRequired") }),
  z.maxLength(PHONE_MAX, { error: t("auth.errors.phoneInvalid") }),
  z.regex(/^\+?[\d\s\-()]+$/, { error: t("auth.errors.phoneInvalid") }),
  z.refine(
    (value) => {
      const count = digitsOf(value).length;
      return count >= 4 && count <= 15;
    },
    { error: t("auth.errors.phoneInvalid") },
  ),
);

const currentPassword = z
  .string()
  .check(
    z.minLength(1, { error: t("auth.errors.passwordRequired") }),
    z.maxLength(1024, { error: t("auth.errors.passwordLong") }),
  );

const newPassword = z.string().check(
  z.minLength(PASSWORD_MIN, { error: t("auth.errors.passwordShort") }),
  z.maxLength(PASSWORD_MAX, { error: t("auth.errors.passwordLong") }),
  z.refine((value) => !ONLY_DIGITS.test(value), {
    error: t("auth.errors.passwordDigits"),
  }),
);

export const loginSchema = z.object({
  countryCode,
  phone,
  password: currentPassword,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({ name, countryCode, phone, password: newPassword })
  .check(
    z.refine(
      (value) =>
        !matchesPhone(
          value.password,
          phoneForms(value.countryCode, value.phone),
        ),
      { error: t("auth.errors.passwordPhone"), path: ["password"] },
    ),
  );
export type RegisterInput = z.infer<typeof registerSchema>;

export const completeProfileSchema = z.object({ name, countryCode, phone });
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword,
    newPassword,
    confirmPassword: z.string(),
  })
  .check(
    z.refine((value) => value.confirmPassword === value.newPassword, {
      error: t("auth.errors.confirmMismatch"),
      path: ["confirmPassword"],
    }),
    z.refine((value) => value.newPassword !== value.currentPassword, {
      error: t("auth.errors.samePassword"),
      path: ["newPassword"],
    }),
  );
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Field errors of a failed parse: the first message per top-level field. */
export function fieldErrorsOf(
  error: z.core.$ZodError,
): Partial<Record<string, string>> {
  const result: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field && result[field] === undefined) result[field] = issue.message;
  }
  return result;
}
