import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.product") };

export default function ProductPage() {
  return <PageTitle>{t("pages.product")}</PageTitle>;
}
