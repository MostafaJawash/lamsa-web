import type { Metadata } from "next";

import { PageChrome } from "@/components/layout/page-chrome";
import { AuthHeader } from "@/features/auth/components/auth-header";
import { RegisterForm } from "@/features/auth/components/register-form";
import { googleMode } from "@/features/auth/google";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.register") };

export default function RegisterPage() {
  return (
    <PageChrome path="/register" width="narrow">
      <AuthHeader
        title={t("auth.register.title")}
        lead={t("auth.register.lead")}
      />
      <RegisterForm google={googleMode()} />
    </PageChrome>
  );
}
