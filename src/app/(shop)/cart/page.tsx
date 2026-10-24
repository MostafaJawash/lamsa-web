import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.cart") };

export default function CartPage() {
  return <PageTitle>{t("pages.cart")}</PageTitle>;
}
