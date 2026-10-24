import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.search") };

export default function SearchPage() {
  return <PageTitle>{t("pages.search")}</PageTitle>;
}
