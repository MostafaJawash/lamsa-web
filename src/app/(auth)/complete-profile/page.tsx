import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.completeProfile") };

export default function CompleteProfilePage() {
  return <PageTitle>{t("pages.completeProfile")}</PageTitle>;
}
