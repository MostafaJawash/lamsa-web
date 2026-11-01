"use client";

import { TextField } from "@/features/auth/components/fields";
import { t } from "@/i18n";

import { saveProfile } from "../settings-actions";
import {
  validateProfile,
  type ProfileValues,
  type SettingsFormState,
} from "../settings-validation";

import { FormMessage, SaveButton } from "./save-button";
import { useSettingsForm } from "./use-settings-form";

/** Name and email (the email is optional; blank removes it). */
export function ProfileForm({
  initial,
  initialState,
}: {
  initial: ProfileValues;
  initialState: SettingsFormState;
}) {
  const form = useSettingsForm<ProfileValues>({
    action: saveProfile,
    initialState,
    initial,
    validate: validateProfile,
  });
  return (
    <form
      action={form.formAction}
      onSubmit={form.onSubmit}
      noValidate
      data-settings-form="profile"
    >
      {form.scripted ? <input type="hidden" name="js" value="1" /> : null}
      <TextField
        label={t("settings.profile.name")}
        error={form.errorOf("name")}
        autoComplete="name"
        {...form.bind("name")}
      />
      <TextField
        label={t("settings.profile.email")}
        error={form.errorOf("email")}
        type="email"
        dir="ltr"
        inputMode="email"
        autoComplete="email"
        {...form.bind("email")}
      />
      <FormMessage message={form.errorOf("form")} />
      <SaveButton pending={form.pending} label={t("settings.profile.save")} />
    </form>
  );
}
