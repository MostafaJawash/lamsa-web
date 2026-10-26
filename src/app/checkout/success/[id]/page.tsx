import type { Metadata } from "next";

import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.checkoutSuccess") };

export default function CheckoutSuccessPage() {
  return (
    <PageChrome path="/checkout/success/[id]">
      <PageTitle>{t("pages.checkoutSuccess")}</PageTitle>
    </PageChrome>
  );
}
