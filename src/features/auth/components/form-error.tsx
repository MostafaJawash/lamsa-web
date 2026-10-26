"use client";

import Link from "next/link";

import { support } from "@/config/site";
import { t } from "@/i18n";

import type { FormError } from "../errors";

function formatWait(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * The form-level error (prototype `.err`) with what each kind needs: the countdown for
 * TOO_MANY_ATTEMPTS, a login link for ALREADY_REGISTERED / an expired Google signup,
 * the store's phone for ACCOUNT_DISABLED. The message itself is announced once
 * (role="alert"); the ticking countdown is not.
 */
export function FormErrorView({
  error,
  secondsLeft,
}: {
  error: FormError | null;
  secondsLeft: number;
}) {
  if (!error) return null;
  if (error.kind === "rateLimited" && secondsLeft === 0) return null;
  return (
    <div className="lm-err">
      <p role="alert">{error.message}</p>
      {error.kind === "rateLimited" ? (
        <p>
          {t("auth.errors.retryIn")}{" "}
          <span className="lm-num" dir="ltr">
            {formatWait(secondsLeft)}
          </span>
        </p>
      ) : null}
      {error.kind === "alreadyRegistered" || error.kind === "signupExpired" ? (
        <Link href="/login" className="lm-link">
          {error.kind === "signupExpired"
            ? t("auth.complete.restart")
            : t("auth.errors.loginInstead")}
        </Link>
      ) : null}
      {error.kind === "disabled" && support.phone ? (
        <p>
          {t("auth.errors.contactStore")}{" "}
          <a
            href={`tel:${support.phone.replace(/[^\d+]/g, "")}`}
            className="lm-link lm-num"
            dir="ltr"
          >
            {support.phone}
          </a>
        </p>
      ) : null}
    </div>
  );
}
