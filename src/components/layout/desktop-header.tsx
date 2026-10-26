import Form from "next/form";
import Link from "next/link";

import {
  BagIcon,
  HeartIcon,
  SearchIcon,
  UserIcon,
} from "@/components/shared/icons";
import { Wordmark } from "@/components/shared/wordmark";
import { t } from "@/i18n";

import { DesktopNav } from "./desktop-nav";

/**
 * Prototype `desktop()` header: `.d-bar` (logo, search, icons) and `.d-nav`.
 * Count badges come with the cart/favorites features (see `CountBadge`).
 */
export function DesktopHeader() {
  return (
    <header className="lm-dhead max-md:hidden">
      <div className="lm-dbar">
        <Link href="/" className="lm-logo" aria-label={t("pages.home")}>
          <Wordmark />
        </Link>
        <Form action="/search" role="search" className="lm-search">
          <SearchIcon />
          <input
            name="q"
            type="search"
            placeholder={t("layout.searchPlaceholder")}
            aria-label={t("layout.search")}
            enterKeyHint="search"
            autoComplete="off"
          />
          <button type="submit" className="lm-btn primary sm">
            {t("layout.searchSubmit")}
          </button>
        </Form>
        <div className="lm-dicons">
          <Link
            href="/favorites"
            className="lm-icon-btn"
            aria-label={t("layout.favorites")}
          >
            <HeartIcon />
          </Link>
          <Link
            href="/cart"
            className="lm-icon-btn"
            aria-label={t("layout.cart")}
          >
            <BagIcon />
          </Link>
          <Link href="/account" className="lm-icon-btn">
            <UserIcon />
            <span>{t("layout.login")}</span>
          </Link>
        </div>
      </div>
      <DesktopNav />
    </header>
  );
}
