import type { Metadata } from "next";

import { AccountShell } from "@/components/layout/account-shell";
import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.notifications") };

export default function NotificationsPage() {
  return (
    <PageChrome path="/account/notifications">
      <AccountShell>
        <PageTitle>{t("pages.notifications")}</PageTitle>
      </AccountShell>
    </PageChrome>
  );
}
