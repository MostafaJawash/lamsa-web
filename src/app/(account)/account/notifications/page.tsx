import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.notifications") };

export default function NotificationsPage() {
  return <PageTitle>{t("pages.notifications")}</PageTitle>;
}
