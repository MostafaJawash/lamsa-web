import type { Metadata } from "next";

import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.favorites") };

export default function FavoritesPage() {
  return (
    <PageChrome path="/favorites">
      <PageTitle>{t("pages.favorites")}</PageTitle>
    </PageChrome>
  );
}
