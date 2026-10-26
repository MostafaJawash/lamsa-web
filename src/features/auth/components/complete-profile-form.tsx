"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { defaultCountryCode } from "@/config/site";
import { t } from "@/i18n";

import { completeProfile } from "../actions";
import { completeProfileSchema, type CompleteProfileInput } from "../schemas";

import { PhoneField, TextField } from "./fields";
import { FormErrorView } from "./form-error";
import { SubmitButton } from "./submit-button";
import { useAuthSubmit } from "./use-auth-submit";

const FIELDS = ["name", "phone"] as const;

/** Google onboarding: name (prefilled from Google) and phone. */
export function CompleteProfileForm({ name }: { name: string }) {
  const form = useForm<CompleteProfileInput>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: { name, countryCode: defaultCountryCode, phone: "" },
  });
  const { onSubmit, pending, formError, secondsLeft, locked } = useAuthSubmit(
    form,
    completeProfile,
    FIELDS,
  );
  const errors = form.formState.errors;

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <TextField
        name="name"
        label={t("auth.fields.name")}
        placeholder={t("auth.fields.namePlaceholder")}
        autoComplete="name"
        error={errors.name?.message}
        registration={form.register("name")}
      />
      <PhoneField
        error={errors.phone?.message}
        countryCode={form.register("countryCode")}
        phone={form.register("phone")}
      />
      <FormErrorView error={formError} secondsLeft={secondsLeft} />
      <SubmitButton
        label={t("auth.complete.submit")}
        pending={pending}
        disabled={locked}
      />
    </form>
  );
}
