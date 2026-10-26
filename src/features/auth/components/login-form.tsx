"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { defaultCountryCode } from "@/config/site";
import { t } from "@/i18n";

import { login } from "../actions";
import type { GoogleMode } from "../google";
import { loginSchema, type LoginInput } from "../schemas";

import { PasswordField, PhoneField } from "./fields";
import { ForgotPasswordDialog } from "./forgot-password-dialog";
import { FormErrorView } from "./form-error";
import { GoogleSignIn } from "./google-sign-in";
import { SubmitButton } from "./submit-button";
import { useAuthSubmit, useNextParam } from "./use-auth-submit";

const FIELDS = ["phone", "password"] as const;

export function LoginForm({ google }: { google: GoogleMode }) {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { countryCode: defaultCountryCode, phone: "", password: "" },
  });
  const { onSubmit, pending, formError, secondsLeft, locked } = useAuthSubmit(
    form,
    login,
    FIELDS,
  );
  const next = useNextParam();
  const errors = form.formState.errors;

  return (
    <>
      <form method="post" onSubmit={onSubmit} noValidate>
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
          autoComplete="current-password"
        />
        <FormErrorView error={formError} secondsLeft={secondsLeft} />
        <SubmitButton
          label={t("auth.login.submit")}
          pending={pending}
          disabled={locked}
        />
      </form>
      <GoogleSignIn mode={google} />
      <div className="lm-auth-links">
        <span>
          {t("auth.login.noAccount")}{" "}
          <Link
            href={{ pathname: "/register", query: next ? { next } : {} }}
            className="lm-link"
          >
            {t("auth.login.register")}
          </Link>
        </span>
        <ForgotPasswordDialog />
      </div>
    </>
  );
}
