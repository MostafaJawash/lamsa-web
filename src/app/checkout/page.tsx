import type { Metadata } from "next";

import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.checkout") };

export default function CheckoutPage() {
  return (
    <PageChrome path="/checkout">
      <PageTitle>{t("pages.checkout")}</PageTitle>
    </PageChrome>
  );
}
