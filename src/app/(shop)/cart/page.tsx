import type { Metadata } from "next";

import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.cart") };

export default function CartPage() {
  return (
    <PageChrome path="/cart">
      <PageTitle>{t("pages.cart")}</PageTitle>
    </PageChrome>
  );
}
