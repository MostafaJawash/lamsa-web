import type { Metadata } from "next";

import { AccountShell } from "@/components/layout/account-shell";
import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.addresses") };

export default function AddressesPage() {
  return (
    <PageChrome path="/account/addresses">
      <AccountShell>
        <PageTitle>{t("pages.addresses")}</PageTitle>
      </AccountShell>
    </PageChrome>
  );
}
