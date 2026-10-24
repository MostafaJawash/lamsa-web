import Link from "next/link";

import { siteConfig } from "@/config/site";
import { t } from "@/i18n";

/**
 * Account pages with the account navigation (placeholder; its design comes with the
 * account feature). TODO: the auth check (redirect to /login) belongs in the pages' data
 * access, not only in src/proxy.ts. Session reads must render inside <Suspense>.
 */
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="lm-pg grid gap-6 md:grid-cols-[14rem_1fr]">
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
      <div className="min-w-0">{children}</div>
    </div>
  );
}
