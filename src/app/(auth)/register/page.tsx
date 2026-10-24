import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.register") };

export default function RegisterPage() {
  return <PageTitle>{t("pages.register")}</PageTitle>;
}
