/**
 * Settings rules (profile, phone change, password change), mirroring the backend:
 * `UserUpdate` (name 1..100 after trimming, optional email up to 255 that must be an
 * address; a blank email clears it), `PhoneChange` (the phone as the auth forms check
 * it, the current password for phone accounts) and the password rules of registration
 * (auth/schemas.ts, reused here). Pure: the forms validate with it for instant feedback
 * and the server actions run the same check again before calling the backend, which
 * stays the judge (its own Arabic message wins when it rejects something).
 */
import type { PhoneCountryCode } from "@/config/site";
import { t } from "@/i18n";
import * as z from "zod/mini";

import {
  changePasswordSchema,
  combinePhone,
  currentPassword,
  fieldErrorsOf,
  phone as phoneSchema,
  NAME_MAX,
} from "@/features/auth/schemas";

export const EMAIL_MAX = 255;

export type SettingsSection = "profile" | "phone" | "password";

export type SettingsField =
  | "name"
  | "email"
  | "phone"
  | "currentPassword"
  | "newPassword"
  | "confirmPassword"
  | "form";

export type SettingsErrors = Partial<Record<SettingsField, string>>;

/**
 * What a settings form posted and what it shows again after a failure. Passwords are
 * never in here: they are not echoed back, and never stored.
 */
export type SettingsFormState = {
  section: SettingsSection;
  errors: SettingsErrors;
  values: Record<string, string>;
} | null;

export type ProfileValues = { name: string; email: string };
export type PhoneValues = {
  countryCode: string;
  phone: string;
  currentPassword: string;
};
export type PasswordValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export function readProfileForm(form: FormData): ProfileValues {
  return { name: text(form, "name"), email: text(form, "email") };
}

export function readPhoneForm(form: FormData): PhoneValues {
  return {
    countryCode: text(form, "countryCode"),
    phone: text(form, "phone"),
    currentPassword: text(form, "currentPassword"),
  };
}

export function readPasswordForm(form: FormData): PasswordValues {
  return {
    currentPassword: text(form, "currentPassword"),
    newPassword: text(form, "newPassword"),
    confirmPassword: text(form, "confirmPassword"),
  };
}

/** Characters as the backend counts them (code points, after trimming). */
function length(value: string): number {
  return [...value.trim()].length;
}

/** A practical address check (one "@", a dotted domain, no spaces); the backend is stricter. */
export function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);
}

export function validateProfile(values: ProfileValues): SettingsErrors {
  const errors: SettingsErrors = {};
  const name = length(values.name);
  if (name === 0) errors.name = t("auth.errors.nameRequired");
  else if (name > NAME_MAX) errors.name = t("auth.errors.nameTooLong");
  const email = values.email.trim();
  if (email) {
    if (email.length > EMAIL_MAX)
      errors.email = t("settings.errors.emailLong", { max: EMAIL_MAX });
    else if (!isEmailLike(email))
      errors.email = t("settings.errors.emailInvalid");
  }
  return errors;
}

/** The combined number (`+963…`) the backend normalizes, from the two form fields. */
export function newPhone(values: Pick<PhoneValues, "countryCode" | "phone">) {
  return combinePhone(values.countryCode as PhoneCountryCode, values.phone);
}

/**
 * `needsPassword`: a phone account (the backend asks for the current password, the phone
 * being its login); a Google account never sees that field.
 */
export function validatePhoneChange(
  values: PhoneValues,
  needsPassword: boolean,
): SettingsErrors {
  const errors: SettingsErrors = {};
  const parsed = z.safeParse(phoneSchema, values.phone);
  if (!parsed.success) errors.phone = firstMessage(parsed);
  if (needsPassword) {
    const password = z.safeParse(currentPassword, values.currentPassword);
    if (!password.success) errors.currentPassword = firstMessage(password);
  }
  return errors;
}

function firstMessage(result: { error?: z.core.$ZodError }): string {
  return result.error?.issues[0]?.message ?? t("auth.errors.phoneInvalid");
}

export function validatePasswordChange(values: PasswordValues): SettingsErrors {
  const parsed = z.safeParse(changePasswordSchema, values);
  if (parsed.success) return {};
  const errors: SettingsErrors = {};
  for (const [field, message] of Object.entries(fieldErrorsOf(parsed.error))) {
    if (
      field === "currentPassword" ||
      field === "newPassword" ||
      field === "confirmPassword"
    )
      errors[field] = message;
  }
  return errors;
}

export function hasErrors(errors: SettingsErrors): boolean {
  return Object.keys(errors).length > 0;
}
