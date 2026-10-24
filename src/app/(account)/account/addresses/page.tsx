import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.addresses") };

export default function AddressesPage() {
  return <PageTitle>{t("pages.addresses")}</PageTitle>;
}
