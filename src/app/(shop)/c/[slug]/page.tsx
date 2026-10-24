import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.category") };

export default function CategoryPage() {
  return <PageTitle>{t("pages.category")}</PageTitle>;
}
