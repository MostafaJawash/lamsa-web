import Link from "next/link";

import { mainNav, SALE_HREF } from "@/config/site";
import { t } from "@/i18n";

/**
 * Prototype `.d-nav`: category tabs. Static (server); each page marks its active tab
 * through `PageChrome` (accent underline, like `.d-nav button.on`).
 */
export function DesktopNav() {
  return (
    <nav className="lm-dnav" aria-label={t("nav.main")}>
      {mainNav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={item.href === SALE_HREF ? "sale" : undefined}
        >
          {t(item.labelKey)}
        </Link>
      ))}
    </nav>
  );
}
