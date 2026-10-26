import type { Metadata } from "next";

import { AccountShell } from "@/components/layout/account-shell";
import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.account") };

export default function AccountPage() {
  return (
    <PageChrome path="/account">
      <AccountShell>
        <PageTitle>{t("pages.account")}</PageTitle>
      </AccountShell>
    </PageChrome>
  );
}
