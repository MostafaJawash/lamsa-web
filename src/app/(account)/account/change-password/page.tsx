import type { Metadata } from "next";
import { Suspense } from "react";

import { PageChrome } from "@/components/layout/page-chrome";
import { AuthHeader } from "@/features/auth/components/auth-header";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { LogoutButtons } from "@/features/auth/components/logout-buttons";
import { t } from "@/i18n";
import { CHANGE_PASSWORD_PATH } from "@/lib/auth/paths";
import { requireUser } from "@/lib/auth/user";

export const metadata: Metadata = {
  title: t("pages.changePassword"),
  robots: { index: false },
};

/**
 * Change password; also the gate page while a temporary password must be changed
 * (src/proxy.ts sends every page here). There, only "تسجيل الخروج" is offered: the
 * backend blocks logout-all until the password is changed.
 */
async function ChangePassword() {
  const user = await requireUser(CHANGE_PASSWORD_PATH);
  if (!user) return <p className="lm-err">{t("auth.account.unavailable")}</p>;
  if (user.auth_provider !== "phone")
    return <p className="lm-note">{t("auth.change.googleAccount")}</p>;
  const temporary = user.must_change_password;
  return (
    <>
      {temporary ? (
        <p className="lm-note mb-4" role="status">
          {t("auth.change.forcedNote")}
        </p>
      ) : null}
      <ChangePasswordForm temporary={temporary} phone={user.phone ?? null} />
      {temporary ? (
        <div className="mt-4">
          <LogoutButtons allDevices={false} />
        </div>
      ) : null}
    </>
  );
}

export default function ChangePasswordPage() {
  return (
    <PageChrome path={CHANGE_PASSWORD_PATH} width="narrow">
      <AuthHeader
        title={t("pages.changePassword")}
        lead={t("auth.change.lead")}
      />
      <Suspense fallback={null}>
        <ChangePassword />
      </Suspense>
    </PageChrome>
  );
}
