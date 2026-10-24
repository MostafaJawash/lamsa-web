import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.sale") };

export default function SalePage() {
  return <PageTitle>{t("pages.sale")}</PageTitle>;
}
