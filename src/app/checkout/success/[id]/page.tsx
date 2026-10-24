import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.checkoutSuccess") };

export default function CheckoutSuccessPage() {
  return <PageTitle>{t("pages.checkoutSuccess")}</PageTitle>;
}
