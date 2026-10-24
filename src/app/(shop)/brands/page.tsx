import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.brands") };

export default function BrandsPage() {
  return <PageTitle>{t("pages.brands")}</PageTitle>;
}
