import type { Route } from "next";

import { t, type MessageKey } from "@/i18n";
import { publicEnv } from "@/lib/env.public";

/** Validates a literal path against the app routes (typedRoutes), including dynamic ones. */
function route<T extends string>(href: Route<T>): Route {
  return href as Route;
}

export type NavItem = {
  labelKey: MessageKey;
  href: Route;
};

/**
 * Category slugs (`makeup`, `care`, `hair`) match the backend's `seed_base` categories.
 * TODO: build the category links from `GET /categories` once the catalog feature exists.
 */
export const mainNav = [
  { labelKey: "nav.new", href: route("/new") },
  { labelKey: "nav.brands", href: route("/brands") },
  { labelKey: "nav.makeup", href: route("/c/makeup") },
  { labelKey: "nav.careAndPerfume", href: route("/c/care") },
  { labelKey: "nav.hair", href: route("/c/hair") },
  { labelKey: "nav.sale", href: route("/sale") },
] as const satisfies readonly NavItem[];

export const accountNav = [
  { labelKey: "pages.account", href: route("/account") },
  { labelKey: "pages.orders", href: route("/account/orders") },
  { labelKey: "pages.addresses", href: route("/account/addresses") },
  { labelKey: "pages.notifications", href: route("/account/notifications") },
  { labelKey: "pages.settings", href: route("/account/settings") },
] as const satisfies readonly NavItem[];

export const siteConfig = {
  name: t("site.name"),
  description: t("site.description"),
  url: publicEnv.NEXT_PUBLIC_SITE_URL,
  locale: "ar",
  themeColor: { light: "#F7F0F2", dark: "#161015" },
  brandColor: "#B8174E",
  mainNav,
  accountNav,
} as const;
