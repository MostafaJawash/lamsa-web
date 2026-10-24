import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.login") };

export default function LoginPage() {
  return <PageTitle>{t("pages.login")}</PageTitle>;
}
