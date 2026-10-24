"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { BackIcon, SearchIcon } from "@/components/shared/icons";
import { navState, siteConfig } from "@/config/site";
import { t } from "@/i18n";

/**
 * Pages visited in this tab since the app loaded. With more than one, "back" can use the
 * browser history; on a page opened directly (deep link) it goes home instead.
 */
let visitedPages = 0;

/**
 * Same box as the real header, without route-specific content: the <Suspense> fallback
 * on routes whose pathname is only known at request time (e.g. /p/[slug]).
 */
export function MobileHeaderFallback() {
  return (
    <header className="lm-mhead md:hidden">
      <span className="sp" />
      <Link
        href="/search"
        className="lm-icon-btn"
        aria-label={t("layout.search")}
      >
        <SearchIcon />
      </Link>
    </header>
  );
}

/**
 * Prototype `mobile()` header: logo on home, else the page title; back on non-root pages.
 * Reads the pathname: render inside <Suspense> with `<MobileHeaderFallback />`.
 */
export function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const state = navState(pathname);

  useEffect(() => {
    visitedPages += 1;
  }, [pathname]);

  const search = (
    <Link
      href="/search"
      className="lm-icon-btn"
      aria-label={t("layout.search")}
    >
      <SearchIcon />
    </Link>
  );

  let content: React.ReactNode;
  if (state.titleKey === null) {
    content = (
      <>
        <Link href="/" className="lm-logo" aria-label={t("pages.home")}>
          {siteConfig.name}
        </Link>
        <span className="sp" />
        {search}
      </>
    );
  } else if (state.isRoot) {
    content = (
      <>
        <span className="lm-mtitle" style={{ paddingInline: 6 }}>
          {t(state.titleKey)}
        </span>
        {search}
      </>
    );
  } else {
    content = (
      <>
        <button
          type="button"
          className="lm-icon-btn"
          aria-label={t("layout.back")}
          onClick={() => (visitedPages > 1 ? router.back() : router.push("/"))}
        >
          <BackIcon />
        </button>
        <span className="lm-mtitle">{t(state.titleKey)}</span>
        {search}
      </>
    );
  }

  return <header className="lm-mhead md:hidden">{content}</header>;
}
