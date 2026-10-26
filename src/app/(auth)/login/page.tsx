import type { Metadata } from "next";

import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.login") };

export default function LoginPage() {
  return (
    <PageChrome path="/login" width="narrow">
      <PageTitle>{t("pages.login")}</PageTitle>
    </PageChrome>
  );
}
