import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.brand") };

export default function BrandPage() {
  return <PageTitle>{t("pages.brand")}</PageTitle>;
}
