import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { siteConfig } from "@/config/site";
import { t } from "@/i18n";

/**
 * Account layout: shop chrome plus the account navigation (placeholder).
 * TODO: the auth check (redirect to /login) belongs in the pages' data access, not
 * only in src/proxy.ts. Anything that reads the session must render inside <Suspense>.
 */
export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <>
      <Header />
      <main id="main" className="flex-1">
        <Container className="grid gap-6 py-6 md:grid-cols-[14rem_1fr]">
          <nav
            aria-label={t("nav.account")}
            className="rounded-xl border border-line bg-surface p-3"
          >
            <ul className="flex gap-1 overflow-x-auto md:flex-col">
              {siteConfig.accountNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-lg px-3 py-2 text-sm whitespace-nowrap text-ink-muted hover:bg-surface-2 hover:text-ink"
                  >
                    {t(item.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>{children}</div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
