import type { Route } from "next";
import Link from "next/link";

import { mainNav, SALE_HREF } from "@/config/site";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

/** Prototype `catChips(active)`: the six sections as chips, mobile only. */
export function CategoryChips({ active }: { active: Route | null }) {
  return (
    <nav className="lm-chips md:hidden" aria-label={t("nav.main")}>
      {mainNav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "lm-chip",
            item.href === active && "on",
            item.href === SALE_HREF && "sale",
          )}
          aria-current={item.href === active ? "page" : undefined}
        >
          {t(item.labelKey)}
        </Link>
      ))}
    </nav>
  );
}
