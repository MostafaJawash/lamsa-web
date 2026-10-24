import Link from "next/link";

import { siteConfig } from "@/config/site";
import { t } from "@/i18n";

import { Container } from "./container";

/**
 * Placeholder header: logo and main navigation.
 * TODO: search, account, favorites and cart (with count) buttons. Anything that reads
 * the session (cookies) must render inside <Suspense> so the rest stays static.
 */
export function Header() {
  return (
    <header
      aria-label={t("layout.header")}
      className="border-b border-line bg-surface"
    >
      <Container className="flex h-16 items-center gap-8">
        <Link
          href="/"
          className="font-display text-3xl leading-none font-bold text-brand"
        >
          {siteConfig.name}
        </Link>
        <nav aria-label={t("nav.main")} className="overflow-x-auto">
          <ul className="flex items-center gap-5 text-sm font-medium whitespace-nowrap">
            {siteConfig.mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-ink-muted transition-colors hover:text-brand"
                >
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </header>
  );
}
