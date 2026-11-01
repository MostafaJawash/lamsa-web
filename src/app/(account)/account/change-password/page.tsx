import type { Metadata } from "next";

import { PageChrome } from "@/components/layout/page-chrome";
import { PasswordForm } from "@/features/account/components/password-form";
import type { SettingsFormState } from "@/features/account/settings-validation";
import { AuthHeader } from "@/features/auth/components/auth-header";
import { LogoutButtons } from "@/features/auth/components/logout-buttons";
import { t } from "@/i18n";
import { safeNext } from "@/lib/auth/next-param";
import { CHANGE_PASSWORD_PATH } from "@/lib/auth/paths";
import { requireUser } from "@/lib/auth/user";
import { readFailure } from "@/lib/form-failure";

/** Personal, always fresh, and usable without JavaScript: rendered in full per request. */
export const instant = false;

export const metadata: Metadata = {
  title: t("pages.changePassword"),
  robots: { index: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Change password; also the gate page while a temporary password must be changed
 * (src/proxy.ts sends every page here, with `?next=` the page that was asked for). There,
 * only "تسجيل الخروج" is offered: the backend blocks logout-all until the password is
 * changed, and the change continues to `next`. Without a pending temporary password it
 * is the same form as on /account/settings.
 */
export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser(CHANGE_PASSWORD_PATH);
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNext(rawNext);
  const failure = readFailure<NonNullable<SettingsFormState>>(params.fs);
  const temporary = user?.must_change_password ?? false;

  let body: React.ReactNode;
  if (!user) body = <p className="lm-err">{t("auth.account.unavailable")}</p>;
  else if (user.auth_provider !== "phone")
    body = <p className="lm-note">{t("auth.change.googleAccount")}</p>;
  else
    body = (
      <>
        {temporary ? (
          <p className="lm-note mb-4" role="status">
            {t("auth.change.forcedNote")}
          </p>
        ) : null}
        <PasswordForm
          gate
          temporary={temporary}
          phone={user.phone ?? null}
          next={next === "/" ? null : next}
          initialState={failure?.section === "password" ? failure : null}
        />
        {temporary ? (
          <div className="mt-4">
            <LogoutButtons allDevices={false} />
          </div>
        ) : null}
      </>
    );

  return (
    <PageChrome path={CHANGE_PASSWORD_PATH} width="narrow">
      <AuthHeader
        title={t("pages.changePassword")}
        lead={t("auth.change.lead")}
      />
      {body}
    </PageChrome>
  );
}
