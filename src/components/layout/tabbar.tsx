"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

const ICONS: Record<TabKey, React.ReactNode> = {
  home: <HomeIcon />,
  categories: <GridIcon />,
  favorites: <HeartIcon />,
  cart: <BagIcon />,
  account: <UserIcon />,
};

/** Prototype `.tabbar`: fixed bottom navigation on mobile, active tab in accent. */
export function TabbarView({ active }: { active: TabKey | null }) {
  return (
    <nav className="lm-tabbar md:hidden" aria-label={t("layout.tabbar")}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
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

/** Reads the pathname: render inside <Suspense> with `<TabbarView active={null} />`. */
export function Tabbar() {
  return <TabbarView active={navState(usePathname()).tab} />;
}
