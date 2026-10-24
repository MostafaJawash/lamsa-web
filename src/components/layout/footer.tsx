import { cacheLife } from "next/cache";

import { t } from "@/i18n";

import { Container } from "./container";

/** The current year, cached so the footer stays part of the static shell. */
async function currentYear(): Promise<number> {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

/** Placeholder footer. TODO: store info, links, delivery and payment notes. */
export async function Footer() {
  const year = await currentYear();
  return (
    <footer
      aria-label={t("layout.footer")}
      className="mt-auto border-t border-line bg-surface"
    >
      <Container className="py-6 text-sm text-ink-muted">
        {t("layout.copyright", { year })}
      </Container>
    </footer>
  );
}
