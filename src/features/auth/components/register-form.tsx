"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";

import { defaultCountryCode } from "@/config/site";
import { t } from "@/i18n";

import { register as registerAction } from "../actions";
import type { GoogleMode } from "../google";
import { phoneForms, registerSchema, type RegisterInput } from "../schemas";

import { PasswordField, PhoneField, TextField } from "./fields";
import { FormErrorView } from "./form-error";
import { GoogleSignIn } from "./google-sign-in";
import { SubmitButton } from "./submit-button";
import { useAuthSubmit, useNextParam } from "./use-auth-submit";

const FIELDS = ["name", "phone", "password"] as const;

export function RegisterForm({ google }: { google: GoogleMode }) {
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      countryCode: defaultCountryCode,
      phone: "",
      password: "",
    },
  });
  const { onSubmit, pending, formError, secondsLeft, locked } = useAuthSubmit(
    form,
    registerAction,
    FIELDS,
  );
  const next = useNextParam();
  const [countryCode, phone, password] = useWatch({
    control: form.control,
    name: ["countryCode", "phone", "password"],
  });
  const errors = form.formState.errors;

  return (
    <>
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
        <PasswordField
          name="password"
          label={t("auth.fields.password")}
          error={errors.password?.message}
          registration={form.register("password")}
          autoComplete="new-password"
          value={password ?? ""}
          phoneForms={phoneForms(
            countryCode ?? defaultCountryCode,
            phone ?? "",
          )}
        />
        <FormErrorView error={formError} secondsLeft={secondsLeft} />
        <SubmitButton
          label={t("auth.register.submit")}
          pending={pending}
          disabled={locked}
        />
      </form>
      <GoogleSignIn mode={google} />
      <div className="lm-auth-links">
        <span>
          {t("auth.register.haveAccount")}{" "}
          <Link
            href={{ pathname: "/login", query: next ? { next } : {} }}
            className="lm-link"
          >
            {t("auth.register.login")}
          </Link>
        </span>
      </div>
    </>
  );
}
