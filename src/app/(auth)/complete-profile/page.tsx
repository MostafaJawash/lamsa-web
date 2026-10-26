import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageChrome } from "@/components/layout/page-chrome";
import { AuthHeader } from "@/features/auth/components/auth-header";
import { CompleteProfileForm } from "@/features/auth/components/complete-profile-form";
import { t } from "@/i18n";
import { readGoogleSignup } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: t("pages.completeProfile"),
  robots: { index: false },
};

/** Needs the Google signup cookie (set by the Google sign-in); otherwise /login. */
async function CompleteProfile() {
  const signup = await readGoogleSignup();
  if (!signup) redirect("/login");
  return (
    <>
      {signup.email ? (
        <p className="lm-hint">
          {t("auth.complete.googleAccount")}{" "}
          <span className="lm-num" dir="ltr">
            {signup.email}
          </span>
        </p>
      ) : null}
      <CompleteProfileForm name={signup.name ?? ""} />
    </>
  );
}

export default function CompleteProfilePage() {
  return (
    <PageChrome path="/complete-profile" width="narrow">
      <AuthHeader
        title={t("pages.completeProfile")}
        lead={t("auth.complete.lead")}
      />
      <Suspense fallback={null}>
        <CompleteProfile />
      </Suspense>
    </PageChrome>
  );
}
