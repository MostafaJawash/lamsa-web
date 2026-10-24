"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { mainNav, navState, SALE_HREF } from "@/config/site";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

/** Prototype `.d-nav`: category tabs; the active one is underlined in accent. */
export function DesktopNavView({ active }: { active: Route | null }) {
  return (
    <nav className="lm-dnav" aria-label={t("nav.main")}>
      {mainNav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
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

/**
 * Reads the pathname (URL data): render inside <Suspense> with
 * `<DesktopNavView active={null} />` as the fallback.
 */
export function DesktopNav() {
  return <DesktopNavView active={navState(usePathname()).desktopTab} />;
}
