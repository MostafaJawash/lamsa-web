import Link from "next/link";

import { SearchIcon } from "@/components/shared/icons";
import { Wordmark } from "@/components/shared/wordmark";
import { t } from "@/i18n";

import { BackButton } from "./back-button";

/**
 * Prototype `mobile()` header (`.m-head`): the logo on home (`title` null), otherwise the
 * page title, with a back button on non-root pages. No hooks, so server pages and the
 * client error boundary can both render it. Rendered by `PageChrome`, once per page.
 */
export function MobileHeaderBar({
  title,
  isRoot,
}: {
  title: string | null;
  isRoot: boolean;
}) {
  const search = (
    <Link
      href="/search"
      className="lm-icon-btn"
      aria-label={t("layout.search")}
    >
      <SearchIcon />
    </Link>
  );
  if (title === null) {
    return (
      <header className="lm-mhead md:hidden">
        <Link href="/" className="lm-logo" aria-label={t("pages.home")}>
          <Wordmark />
        </Link>
        <span className="sp" />
        {search}
      </header>
    );
  }
  return (
    <header className="lm-mhead md:hidden">
      {isRoot ? null : <BackButton label={t("layout.back")} />}
      <span
        className="lm-mtitle"
        style={isRoot ? { paddingInline: 6 } : undefined}
      >
        {title}
      </span>
      {search}
    </header>
  );
}
