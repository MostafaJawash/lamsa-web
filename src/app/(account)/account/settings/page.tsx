import type { Metadata } from "next";

import { AccountShell } from "@/components/layout/account-shell";
import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.settings") };

export default function SettingsPage() {
  return (
    <PageChrome path="/account/settings">
      <AccountShell>
        <PageTitle>{t("pages.settings")}</PageTitle>
      </AccountShell>
    </PageChrome>
  );
}
