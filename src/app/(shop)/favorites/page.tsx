import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.favorites") };

export default function FavoritesPage() {
  return <PageTitle>{t("pages.favorites")}</PageTitle>;
}
