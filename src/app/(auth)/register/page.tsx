import type { Metadata } from "next";

import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.register") };

export default function RegisterPage() {
  return (
    <PageChrome path="/register" width="narrow">
      <PageTitle>{t("pages.register")}</PageTitle>
    </PageChrome>
  );
}
