import type { Route } from "next";

import { t, type MessageKey } from "@/i18n";
import { publicEnv } from "@/lib/env.public";

/** Validates a literal path against the app routes (typedRoutes), including dynamic ones. */
function route<T extends string>(href: Route<T>): Route {
  return href as Route;
}

/** The desktop tab of a top-level category, when the nav has one ("/c/makeup"). */
export function tabForCategory(slug: string | null | undefined): Route | null {
  if (!slug) return null;
  const href = `/c/${slug}`;
  return mainNav.find((item) => item.href === href)?.href ?? null;
}

export type NavItem = {
  labelKey: MessageKey;
  href: Route;
};

/**
 * Desktop tabs and mobile chips, in the prototype order (CATS). Category slugs
 * (`makeup`, `care`, `hair`) match the backend's `seed_base` categories.
 */
export const mainNav = [
  { labelKey: "nav.new", href: route("/new") },
  { labelKey: "nav.brands", href: route("/brands") },
  { labelKey: "nav.makeup", href: route("/c/makeup") },
  { labelKey: "nav.careAndPerfume", href: route("/c/care") },
  { labelKey: "nav.hair", href: route("/c/hair") },
  { labelKey: "nav.sale", href: route("/sale") },
] as const satisfies readonly NavItem[];

/** The tab drawn in accent (prototype `.d-nav button.sale`, `.chip.sale`). */
export const SALE_HREF: Route = route("/sale");

export const accountNav = [
  { labelKey: "pages.account", href: route("/account") },
  { labelKey: "pages.orders", href: route("/account/orders") },
  { labelKey: "pages.addresses", href: route("/account/addresses") },
  { labelKey: "pages.notifications", href: route("/account/notifications") },
  { labelKey: "pages.settings", href: route("/account/settings") },
] as const satisfies readonly NavItem[];

/**
 * Country codes of the phone field (prototype `.ph-row` select), in the prototype
 * order; the first is the default. The backend normalizes the combined number.
 */
export const phoneCountryCodes = [
  "+49",
  "+33",
  "+961",
  "+963",
  "+962",
] as const;
export type PhoneCountryCode = (typeof phoneCountryCodes)[number];
export const defaultCountryCode: PhoneCountryCode = phoneCountryCodes[0];

/**
 * Store contact for "forgot password" (there is no self-service reset: the store gives
 * a temporary password by phone). Empty values hide the matching link.
 */
export const support = {
  phone: publicEnv.NEXT_PUBLIC_SUPPORT_PHONE,
  whatsapp: publicEnv.NEXT_PUBLIC_SUPPORT_WHATSAPP,
} as const;

/**
 * Guest cart and favorites (kept in cookies, see src/features/cart/guest-codec.ts): the
 * backend defaults of `cart_max_lines` and `favorites_max`, and the quantity range that
 * POST /cart/preview accepts per item.
 */
export const guestLimits = {
  cartLines: 50,
  favorites: 200,
  maxQuantity: 99,
} as const;

export type TabKey = "home" | "categories" | "favorites" | "cart" | "account";

/** Mobile tabbar (prototype `tabs`). */
export const tabs = [
  { key: "home", labelKey: "tabs.home", href: route("/") },
  {
    key: "categories",
    labelKey: "tabs.categories",
    href: route("/categories"),
  },
  { key: "favorites", labelKey: "tabs.favorites", href: route("/favorites") },
  { key: "cart", labelKey: "tabs.cart", href: route("/cart") },
  { key: "account", labelKey: "tabs.account", href: route("/account") },
] as const satisfies readonly (NavItem & { key: TabKey })[];

export type NavState = {
  /** Href of the active desktop tab, if any. */
  desktopTab: Route | null;
  /** Active mobile tab (prototype `tabOf`). */
  tab: TabKey | null;
  /** Mobile header title; null on the home page (the logo is shown). */
  titleKey: MessageKey | null;
  /** Root pages have no back button (prototype `roots`). */
  isRoot: boolean;
};

const ROOTS = new Set(["/", "/categories", "/favorites", "/cart", "/account"]);

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Title for the mobile header, by route. */
function titleFor(pathname: string): MessageKey | null {
  const exact: Record<string, MessageKey> = {
    "/categories": "pages.categories",
    "/brands": "pages.brands",
    "/new": "pages.new",
    "/sale": "pages.sale",
    "/search": "pages.search",
    "/cart": "pages.cart",
    "/favorites": "pages.favorites",
    "/login": "pages.login",
    "/register": "pages.register",
    "/complete-profile": "pages.completeProfile",
    "/account": "pages.account",
    "/account/addresses": "pages.addresses",
    "/account/orders": "pages.orders",
    "/account/notifications": "pages.notifications",
    "/account/settings": "pages.settings",
    "/account/change-password": "pages.changePassword",
    "/checkout": "pages.checkout",
  };
  if (pathname === "/") return null;
  const known = exact[pathname];
  if (known) return known;
  if (pathname.startsWith("/c/")) return "pages.category";
  if (pathname.startsWith("/brands/")) return "pages.brand";
  if (pathname.startsWith("/p/")) return "pages.product";
  if (pathname.startsWith("/account/orders/")) return "pages.orderDetail";
  if (pathname.startsWith("/checkout/success/")) return "pages.checkoutSuccess";
  return "errors.notFoundTitle";
}

/** Prototype `tabOf`: which tab a page belongs to. */
function tabFor(pathname: string): TabKey | null {
  if (pathname === "/") return "home";
  if (
    ["/categories", "/c", "/brands", "/p", "/new", "/sale", "/search"].some(
      (base) => isUnder(pathname, base),
    )
  ) {
    return "categories";
  }
  if (isUnder(pathname, "/favorites")) return "favorites";
  if (isUnder(pathname, "/cart") || isUnder(pathname, "/checkout"))
    return "cart";
  if (
    ["/account", "/login", "/register", "/complete-profile"].some((base) =>
      isUnder(pathname, base),
    )
  ) {
    return "account";
  }
  return null;
}

export function navState(pathname: string): NavState {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const desktop = mainNav.find((item) => isUnder(path, item.href));
  return {
    desktopTab: desktop ? desktop.href : null,
    tab: tabFor(path),
    titleKey: titleFor(path),
    isRoot: ROOTS.has(path),
  };
}

export const siteConfig = {
  name: t("site.name"),
  description: t("site.description"),
  url: publicEnv.NEXT_PUBLIC_SITE_URL,
  locale: "ar",
  themeColor: { light: "#F7F0F2", dark: "#161015" },
  brandColor: "#B8174E",
  mainNav,
  accountNav,
  tabs,
  phoneCountryCodes,
  defaultCountryCode,
  support,
} as const;
