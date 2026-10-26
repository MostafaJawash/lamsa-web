"use client";

import { useActionState } from "react";

import { t } from "@/i18n";

import { logout, logoutAll } from "../actions";
import type { AuthResult } from "../errors";

import { FormErrorView } from "./form-error";

/**
 * "تسجيل الخروج" and, outside the password-change gate (the backend blocks it there),
 * "تسجيل الخروج من كل الأجهزة". Plain forms posting to server actions (work before
 * hydration); both redirect to "/" on success.
 */
export function LogoutButtons({ allDevices = true }: { allDevices?: boolean }) {
  const [, logoutAction, loggingOut] = useActionState<AuthResult | null>(
    logout,
    null,
  );
  const [allState, logoutAllAction, loggingOutAll] =
    useActionState<AuthResult | null>(logoutAll, null);
  const busy = loggingOut || loggingOutAll;
  return (
    <div className="acts">
      <form action={logoutAction}>
        <button
          type="submit"
          className="lm-btn ghost sm"
          disabled={busy}
          aria-busy={loggingOut || undefined}
        >
          {t("auth.account.logout")}
        </button>
      </form>
      {allDevices ? (
        <form action={logoutAllAction}>
          <button
            type="submit"
            className="lm-btn ghost sm"
            disabled={busy}
            aria-busy={loggingOutAll || undefined}
          >
            {t("auth.account.logoutAll")}
          </button>
        </form>
      ) : null}
      {allState && !allState.ok ? (
        <FormErrorView error={allState.formError} secondsLeft={0} />
      ) : null}
    </div>
  );
}
