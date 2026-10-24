import { cacheLife } from "next/cache";

import { t } from "@/i18n";
import { formatYearArabic } from "@/lib/format";

/** The current year, cached so the footer stays part of the static shell. */
async function currentYear(): Promise<number> {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

/** Prototype `.d-foot` (desktop only; the mobile app has no footer). Links come later. */
export async function Footer() {
  const year = formatYearArabic(await currentYear());
  return (
    <footer className="lm-dfoot max-md:hidden">
      <span>{t("layout.copyright", { year })}</span>
      <span>{t("layout.shippingReturns")}</span>
      <span>{t("layout.contact")}</span>
      <span>{t("layout.cashOnDelivery")}</span>
    </footer>
  );
}
