import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.new") };

export default function NewArrivalsPage() {
  return <PageTitle>{t("pages.new")}</PageTitle>;
}
