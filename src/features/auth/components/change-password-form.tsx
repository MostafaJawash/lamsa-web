"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { t } from "@/i18n";

import { changePassword } from "../actions";
import { changePasswordSchema, type ChangePasswordInput } from "../schemas";

import { PasswordField } from "./fields";
import { FormErrorView } from "./form-error";
import { SubmitButton } from "./submit-button";
import { useAuthSubmit } from "./use-auth-submit";

const FIELDS = ["currentPassword", "newPassword", "confirmPassword"] as const;

/**
 * Current password, new password (with the rule hints; `phone` in E.164 for the
 * "not the phone" rule) and its confirmation. The action stores the fresh pair.
 */
export function ChangePasswordForm({
  temporary,
  phone,
}: {
  /** The current password is the store's temporary one. */
  temporary: boolean;
  phone: string | null;
}) {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const { onSubmit, pending, formError, secondsLeft, locked } = useAuthSubmit(
    form,
    changePassword,
    FIELDS,
  );
  const newPassword = useWatch({ control: form.control, name: "newPassword" });
  const errors = form.formState.errors;
  const forms = phone
    ? [phone, phone.slice(1), `00${phone.slice(1)}`]
    : undefined;

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <PasswordField
        name="currentPassword"
        label={
          temporary
            ? t("auth.fields.temporaryPassword")
            : t("auth.fields.currentPassword")
        }
        error={errors.currentPassword?.message}
        registration={form.register("currentPassword")}
        autoComplete="current-password"
      />
      <PasswordField
        name="newPassword"
        label={t("auth.fields.newPassword")}
        error={errors.newPassword?.message}
        registration={form.register("newPassword")}
        autoComplete="new-password"
        value={newPassword ?? ""}
        phoneForms={forms}
      />
      <PasswordField
        name="confirmPassword"
        label={t("auth.fields.confirmPassword")}
        error={errors.confirmPassword?.message}
        registration={form.register("confirmPassword")}
        autoComplete="new-password"
      />
      <FormErrorView error={formError} secondsLeft={secondsLeft} />
      <SubmitButton
        label={t("auth.change.submit")}
        pending={pending}
        disabled={locked}
      />
    </form>
  );
}
