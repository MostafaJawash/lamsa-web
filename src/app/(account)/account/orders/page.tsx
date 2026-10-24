import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.orders") };

export default function OrdersPage() {
  return <PageTitle>{t("pages.orders")}</PageTitle>;
}
