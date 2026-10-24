import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.account") };

export default function AccountPage() {
  return <PageTitle>{t("pages.account")}</PageTitle>;
}
