import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.home") };

export default function HomePage() {
  return <PageTitle>{t("pages.home")}</PageTitle>;
}
