"use client";

import { defaultCountryCode } from "@/config/site";
import { PasswordField, PhoneField } from "@/features/auth/components/fields";
import { t } from "@/i18n";

import { changePhone } from "../settings-actions";
import {
  validatePhoneChange,
  type PhoneValues,
  type SettingsFormState,
} from "../settings-validation";

import { FormMessage, SaveButton } from "./save-button";
import { useSettingsForm } from "./use-settings-form";

/**
 * The login phone: country code and number (checked like the auth forms), and the
 * current password for phone accounts (`needsPassword`); Google accounts have none.
 */
export function PhoneForm({
  needsPassword,
  initialState,
}: {
  needsPassword: boolean;
  initialState: SettingsFormState;
}) {
  const form = useSettingsForm<PhoneValues>({
    action: changePhone,
    initialState,
    initial: {
      countryCode: defaultCountryCode,
      phone: "",
      currentPassword: "",
    },
    validate: (values) => validatePhoneChange(values, needsPassword),
  });
  return (
    <form
      action={form.formAction}
      onSubmit={form.onSubmit}
      noValidate
      data-settings-form="phone"
    >
      {form.scripted ? <input type="hidden" name="js" value="1" /> : null}
      <PhoneField
        label={t("settings.phone.newPhone")}
        error={form.errorOf("phone")}
        countryCode={form.bind("countryCode")}
        phone={form.bind("phone")}
      />
      {needsPassword ? (
        <PasswordField
          name="currentPassword"
          label={t("auth.fields.currentPassword")}
          error={form.errorOf("currentPassword")}
          autoComplete="current-password"
          inputProps={form.bind("currentPassword")}
        />
      ) : null}
      <FormMessage message={form.errorOf("form")} />
      <SaveButton pending={form.pending} label={t("settings.phone.save")} />
    </form>
  );
}
