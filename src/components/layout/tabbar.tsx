"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

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

import { CountBadge } from "./count-badge";
import { recordVisit } from "./nav-history";

const ICONS: Record<TabKey, React.ReactNode> = {
  home: <HomeIcon />,
  categories: <GridIcon />,
  favorites: <HeartIcon />,
  cart: <BagIcon />,
  account: <UserIcon />,
};

/**
 * Prototype `.tabbar`: fixed bottom navigation on mobile, active tab in accent, count
 * badges on favorites and cart. "حسابي" goes to /account when signed in, /login for
 * guests (`accountHref`).
 */
type TabCounts = { cart: number; favorites: number; notifications: number };

export function TabbarView({
  active,
  accountHref,
  counts,
  navRef,
}: {
  active: TabKey | null;
  accountHref: Route;
  /** Badges (prototype `.tabbar .badge`); absent in the static fallback. */
  counts?: TabCounts;
  /** The <nav>, so `Tabbar` can switch the icon pop on after the first navigation. */
  navRef?: React.Ref<HTMLElement>;
}) {
  return (
    <nav
      ref={navRef}
      className="lm-tabbar md:hidden"
      aria-label={t("layout.tabbar")}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.key === "account" ? accountHref : tab.href}
          className={cn(tab.key === active && "on")}
          aria-current={tab.key === active ? "page" : undefined}
        >
          {ICONS[tab.key]}
          <span>{t(tab.labelKey)}</span>
          {counts && (tab.key === "cart" || tab.key === "favorites") ? (
            <CountBadge kind={tab.key} initial={counts[tab.key]} />
          ) : null}
          {counts && tab.key === "account" ? (
            <CountBadge kind="notifications" initial={counts.notifications} />
          ) : null}
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
export function Tabbar({
  accountHref,
  counts,
}: {
  accountHref: Route;
  counts: TabCounts;
}) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const firstPath = useRef(true);
  useEffect(() => {
    recordVisit();
    // The newly active icon pops (CSS, `.lm-tabbar[data-pop]`): only after a navigation,
    // never on the first paint. A direct DOM attribute, so no extra render.
    if (firstPath.current) firstPath.current = false;
    else navRef.current?.setAttribute("data-pop", "");
  }, [pathname]);
  return (
    <TabbarView
      navRef={navRef}
      active={navState(pathname).tab}
      accountHref={accountHref}
      counts={counts}
    />
  );
}
