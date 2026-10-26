"use client";

import { useId, useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import {
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  XIcon,
} from "@/components/shared/icons";
import { phoneCountryCodes } from "@/config/site";
import { t } from "@/i18n";
// clsx, not cn(): no tailwind-merge in the client bundle for static class lists.
import { clsx as cn } from "clsx";

import { passwordRules, type PasswordRule } from "../schemas";

/**
 * ids of a field's input, error and hint (aria-describedby), unique per form: Next.js
 * keeps visited pages mounted but hidden (<Activity>), so two forms can share a page.
 * Tests address fields by `data-field`.
 */
function useIds(name: string) {
  const base = useId();
  return {
    input: `${base}${name}`,
    error: `${base}${name}-err`,
    hint: `${base}${name}-hint`,
  };
}

function describedBy(...values: (string | false | null | undefined)[]) {
  const list = values.filter(Boolean).join(" ");
  return list || undefined;
}

function FieldError({
  id,
  name,
  message,
}: {
  id: string;
  name: string;
  message?: string;
}) {
  if (!message) return null;
  return (
    <p id={id} className="lm-err" data-field-error={name}>
      {message}
    </p>
  );
}

/** Prototype `.fld` with an `.inp`: label, input, error. */
export function TextField({
  name,
  label,
  error,
  registration,
  ...input
}: {
  name: string;
  label: string;
  error?: string;
  registration: UseFormRegisterReturn;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">) {
  const id = useIds(name);
  return (
    <div className="lm-fld">
      <label htmlFor={id.input}>{label}</label>
      <input
        id={id.input}
        data-field={name}
        className="lm-inp"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(error && id.error)}
        {...input}
        {...registration}
      />
      <FieldError id={id.error} name={name} message={error} />
    </div>
  );
}

/**
 * Prototype `.ph-row`: the country code select and the number (LTR, tel keyboard).
 * The action combines them; the backend normalizes the number.
 */
export function PhoneField({
  error,
  countryCode,
  phone,
}: {
  error?: string;
  countryCode: UseFormRegisterReturn;
  phone: UseFormRegisterReturn;
}) {
  const id = useIds("phone");
  return (
    <div className="lm-fld">
      <label htmlFor={id.input}>{t("auth.fields.phone")}</label>
      <div className="lm-ph-row">
        <select
          className="lm-inp"
          aria-label={t("auth.fields.countryCode")}
          autoComplete="tel-country-code"
          {...countryCode}
        >
          {phoneCountryCodes.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <input
          id={id.input}
          data-field="phone"
          className="lm-inp"
          type="tel"
          dir="ltr"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={t("auth.fields.phonePlaceholder")}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(error && id.error)}
          {...phone}
        />
      </div>
      <FieldError id={id.error} name="phone" message={error} />
    </div>
  );
}

const RULES: PasswordRule[] = ["length", "notDigits", "notPhone"];

/**
 * Password `.inp` with a show/hide toggle and, for new passwords, the backend rules as
 * live `.hint` lines (`.hint.ok` when met). `phoneForms`: the phone spellings the
 * password must not equal (no "notPhone" rule without them).
 */
export function PasswordField({
  name,
  label,
  error,
  registration,
  autoComplete,
  value,
  phoneForms,
}: {
  name: string;
  label: string;
  error?: string;
  registration: UseFormRegisterReturn;
  autoComplete: "current-password" | "new-password";
  /** The current value, to show the rules live (new passwords only). */
  value?: string;
  phoneForms?: readonly string[];
}) {
  const [visible, setVisible] = useState(false);
  const id = useIds(name);
  const showRules = value !== undefined;
  const met = showRules ? passwordRules(value, phoneForms ?? []) : null;
  const rules = RULES.filter((rule) => rule !== "notPhone" || phoneForms);
  return (
    <div className="lm-fld">
      <label htmlFor={id.input}>{label}</label>
      <div className="lm-pw">
        <input
          id={id.input}
          data-field={name}
          className="lm-inp"
          type={visible ? "text" : "password"}
          dir="auto"
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(
            error && id.error,
            showRules && id.hint,
          )}
          {...registration}
        />
        <button
          type="button"
          className="lm-icon-btn"
          aria-label={
            visible
              ? t("auth.fields.hidePassword")
              : t("auth.fields.showPassword")
          }
          aria-controls={id.input}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {met ? (
        <ul
          id={id.hint}
          className="lm-rules"
          aria-label={t("auth.rules.label")}
        >
          {rules.map((rule) => (
            <li key={rule} className={cn("lm-hint", met[rule] && "ok")}>
              {met[rule] ? <CheckIcon /> : <XIcon />}
              <span>{t(`auth.rules.${rule}`)}</span>
              <span className="sr-only">
                {met[rule] ? t("auth.rules.met") : t("auth.rules.unmet")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <FieldError id={id.error} name={name} message={error} />
    </div>
  );
}
