"use client";

import { PasswordField } from "@/features/auth/components/fields";
import { t } from "@/i18n";

import { changeAccountPassword } from "../settings-actions";
import {
  validatePasswordChange,
  type PasswordValues,
  type SettingsFormState,
} from "../settings-validation";

import { FormMessage, SaveButton } from "./save-button";
import { useSettingsForm } from "./use-settings-form";

const EMPTY: PasswordValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

/**
 * Current password, new password (with the rule hints; `phone` in E.164 for the "not the
 * phone" rule) and its confirmation. Used on /account/settings and on the page a
 * temporary password is forced onto (`gate`, with the `next` to continue to).
 */
export function PasswordForm({
  phone,
  temporary = false,
  gate = false,
  next = null,
  initialState,
}: {
  phone: string | null;
  /** The current password is the store's temporary one. */
  temporary?: boolean;
  /** The forced page (full-width button, goes on to `next` afterwards). */
  gate?: boolean;
  next?: string | null;
  initialState: SettingsFormState;
}) {
  const form = useSettingsForm<PasswordValues>({
    action: changeAccountPassword,
    initialState,
    initial: EMPTY,
    validate: validatePasswordChange,
  });
  const newPassword = form.bind("newPassword");
  const forms = phone
    ? [phone, phone.slice(1), `00${phone.slice(1)}`]
    : undefined;
  return (
    <form
      action={form.formAction}
      onSubmit={form.onSubmit}
      noValidate
      data-settings-form="password"
    >
      {form.scripted ? <input type="hidden" name="js" value="1" /> : null}
      <input
        type="hidden"
        name="return_to"
        value={gate ? "gate" : "settings"}
      />
      {gate && next ? <input type="hidden" name="next" value={next} /> : null}
      <PasswordField
        name="currentPassword"
        label={
          temporary
            ? t("auth.fields.temporaryPassword")
            : t("auth.fields.currentPassword")
        }
        error={form.errorOf("currentPassword")}
        autoComplete="current-password"
        inputProps={form.bind("currentPassword")}
      />
      <PasswordField
        name="newPassword"
        label={t("auth.fields.newPassword")}
        error={form.errorOf("newPassword")}
        autoComplete="new-password"
        value={newPassword.value}
        phoneForms={forms}
        inputProps={newPassword}
      />
      <PasswordField
        name="confirmPassword"
        label={t("auth.fields.confirmPassword")}
        error={form.errorOf("confirmPassword")}
        autoComplete="new-password"
        inputProps={form.bind("confirmPassword")}
      />
      <FormMessage message={form.errorOf("form")} />
      <SaveButton
        pending={form.pending}
        label={t("auth.change.submit")}
        block={gate}
      />
    </form>
  );
}
