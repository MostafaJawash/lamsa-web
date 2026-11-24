import Link from "next/link";
import { Suspense } from "react";

import {
  ALL_PRODUCTS_HREF,
  GIFTS_HREF,
  mainNav,
  SALE_HREF,
} from "@/config/site";
import { getGiftsEntry } from "@/features/catalog/gifts";
import { t } from "@/i18n";

/** The gift boxes link: the backend category's name; hidden when there is no such category. */
async function GiftsLink() {
  const gifts = await getGiftsEntry();
  if (!gifts) return null;
  return <Link href={GIFTS_HREF}>{gifts.label}</Link>;
}

/**
 * Prototype `.d-nav`: category tabs, plus "كل المنتجات" first and the gift boxes last.
 * Static (server) except the gifts link, which is a small <Suspense> hole (nothing shifts:
 * it is the last link). Each page marks its active tab through `PageChrome` (accent
 * underline, like `.d-nav button.on`).
 */
export function DesktopNav() {
  return (
    <nav className="lm-dnav" aria-label={t("nav.main")}>
      <Link href={ALL_PRODUCTS_HREF}>{t("nav.allProducts")}</Link>
      {mainNav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={item.href === SALE_HREF ? "sale" : undefined}
        >
          {t(item.labelKey)}
        </Link>
      ))}
      <Suspense fallback={null}>
        <GiftsLink />
      </Suspense>
    </nav>
  );
}
