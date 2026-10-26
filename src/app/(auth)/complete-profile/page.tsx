import type { Metadata } from "next";

import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.completeProfile") };

export default function CompleteProfilePage() {
  return (
    <PageChrome path="/complete-profile" width="narrow">
      <PageTitle>{t("pages.completeProfile")}</PageTitle>
    </PageChrome>
  );
}
