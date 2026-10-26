import Link from "next/link";

import { siteConfig } from "@/config/site";
import { t } from "@/i18n";

/**
 * Account pages: the account navigation next to the page (placeholder; its design comes
 * with the account feature). Rendered inside `PageChrome` by each account page.
 * Auth: src/proxy.ts redirects guests optimistically from the cookies; pages that read
 * user data call requireUser() (src/lib/auth/user.ts) inside <Suspense>.
 */
export function AccountShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
      <nav
        aria-label={t("nav.account")}
        className="min-w-0 rounded-xl border border-line bg-surface p-3"
      >
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {siteConfig.accountNav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-11 items-center rounded-lg px-3 text-sm whitespace-nowrap text-ink-muted hover:bg-surface-2 hover:text-ink"
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
