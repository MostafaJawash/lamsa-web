import type { Metadata } from "next";

import { AccountShell } from "@/components/layout/account-shell";
import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.orderDetail") };

export default function OrderDetailPage() {
  return (
    <PageChrome path="/account/orders/[id]">
      <AccountShell>
        <PageTitle>{t("pages.orderDetail")}</PageTitle>
      </AccountShell>
    </PageChrome>
  );
}
