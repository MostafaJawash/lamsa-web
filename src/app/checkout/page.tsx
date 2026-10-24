import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.checkout") };

export default function CheckoutPage() {
  return <PageTitle>{t("pages.checkout")}</PageTitle>;
}
