"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  BagIcon,
  GridIcon,
  HeartIcon,
  HomeIcon,
  UserIcon,
} from "@/components/shared/icons";
import { navState, tabs, type TabKey } from "@/config/site";
import { t } from "@/i18n";
// clsx, not cn(): no tailwind-merge in the client bundle for static class lists.
import { clsx as cn } from "clsx";

import { recordVisit } from "./nav-history";

const ICONS: Record<TabKey, React.ReactNode> = {
  home: <HomeIcon />,
  categories: <GridIcon />,
  favorites: <HeartIcon />,
  cart: <BagIcon />,
  account: <UserIcon />,
};

/**
 * Prototype `.tabbar`: fixed bottom navigation on mobile, active tab in accent.
 * "حسابي" goes to /account when signed in, /login for guests (`accountHref`).
 */
export function TabbarView({
  active,
  accountHref,
}: {
  active: TabKey | null;
  accountHref: Route;
}) {
  return (
    <nav className="lm-tabbar md:hidden" aria-label={t("layout.tabbar")}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.key === "account" ? accountHref : tab.href}
          className={cn(tab.key === active && "on")}
          aria-current={tab.key === active ? "page" : undefined}
        >
          {ICONS[tab.key]}
          <span>{t(tab.labelKey)}</span>
        </Link>
      ))}
    </nav>
  );
}

/**
 * Reads the pathname: rendered by `TabbarLive` (which reads the session) inside
 * <Suspense> with `<TabbarView active={null} accountHref="/account" />`.
 * Always mounted, so it also counts visited pages for the back button (nav-history).
 */
export function Tabbar({ accountHref }: { accountHref: Route }) {
  const pathname = usePathname();
  useEffect(() => {
    recordVisit();
  }, [pathname]);
  return (
    <TabbarView active={navState(pathname).tab} accountHref={accountHref} />
  );
}
