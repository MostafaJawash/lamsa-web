import type { Route } from "next";

import type { MessageKey } from "@/i18n";

import type { Link } from "./types";

/** Where a banner (or push / campaign) link leads on the website. */
export type LinkTarget =
  | { kind: "internal"; href: Route }
  | { kind: "external"; href: string }
  | { kind: "none" };

function slug(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? encodeURIComponent(trimmed) : null;
}

/**
 * Maps a backend link `{type, value}` to a site route. Unknown or incomplete links (and
 * admin-only types) become `none`, so the banner renders without a link.
 */
export function linkTarget(link: Link): LinkTarget {
  switch (link.type) {
    case "category": {
      const s = slug(link.value);
      return s
        ? { kind: "internal", href: `/c/${s}` as Route }
        : { kind: "none" };
    }
    case "product": {
      const s = slug(link.value);
      return s
        ? { kind: "internal", href: `/p/${s}` as Route }
        : { kind: "none" };
    }
    case "brand": {
      const s = slug(link.value);
      return s
        ? { kind: "internal", href: `/brands/${s}` as Route }
        : { kind: "none" };
    }
    case "new":
      return { kind: "internal", href: "/new" };
    case "sale":
      return { kind: "internal", href: "/sale" };
    case "url":
      return link.value && /^https:\/\//i.test(link.value)
        ? { kind: "external", href: link.value }
        : { kind: "none" };
    default:
      return { kind: "none" };
  }
}

/** CTA pill text, as in the prototype: sale → "تسوّق العروض", new → "شوف الجديد", else "اكتشف". */
export function ctaKey(link: Link): MessageKey {
  if (link.type === "sale") return "home.banners.ctaSale";
  if (link.type === "new") return "home.banners.ctaNew";
  return "home.banners.ctaDefault";
}
