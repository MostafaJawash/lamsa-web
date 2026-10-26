import type { Route } from "next";
import Link from "next/link";

import { t } from "@/i18n";

export type Crumb = { name: string; href: Route | null };

/** Prototype `.crumbs` (desktop only): الرئيسية / … / current page. */
export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="lm-crumbs max-md:hidden" aria-label={t("list.breadcrumb")}>
      {items.map((item, index) => (
        <span key={`${item.name}-${index}`} className="contents">
          {index > 0 ? <span aria-hidden="true">/</span> : null}
          {item.href ? (
            <Link href={item.href}>{item.name}</Link>
          ) : (
            <span aria-current="page">{item.name}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
