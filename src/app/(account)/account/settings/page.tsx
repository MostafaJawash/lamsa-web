import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.settings") };

export default function SettingsPage() {
  return <PageTitle>{t("pages.settings")}</PageTitle>;
}
