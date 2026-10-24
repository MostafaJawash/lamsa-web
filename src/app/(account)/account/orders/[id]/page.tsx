import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.orderDetail") };

export default function OrderDetailPage() {
  return <PageTitle>{t("pages.orderDetail")}</PageTitle>;
}
