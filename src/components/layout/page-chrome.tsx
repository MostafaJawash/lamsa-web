import type { Route } from "next";

import { navState } from "@/config/site";
import { t } from "@/i18n";

import { MobileHeaderBar } from "./mobile-header";
import { PageStyle } from "./page-style";

type PageChromeProps = {
  /** The page's route, e.g. "/c/[slug]": gives the default title, back button and tab. */
  path: string;
  /** The real name (category, brand, product) instead of the route default. */
  title?: string;
  /** Desktop tab to mark; defaults to the route's own tab (null: none). */
  activeTab?: Route | null;
  /** "narrow": the prototype `.auth` block (login, register, …). */
  width?: "default" | "narrow";
  children: React.ReactNode;
};

/** Escapes a value for a CSS attribute selector in double quotes. */
function cssString(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

/**
 * Everything a page adds to the site chrome, rendered by every page exactly once:
 * the mobile header (`.m-head` with the real title), the desktop active tab, and the
 * prototype `.pg` content box. The layout keeps only what never changes per page.
 *
 * The active desktop tab is marked by a small page-level style rule (PageStyle, which
 * switches itself off while Next.js keeps the page hidden), so the nav stays static.
 */
export function PageChrome({
  path,
  title,
  activeTab,
  width = "default",
  children,
}: PageChromeProps) {
  const state = navState(path);
  const heading = title ?? (state.titleKey === null ? null : t(state.titleKey));
  const tab = activeTab === undefined ? state.desktopTab : activeTab;
  const href = tab ? cssString(tab) : null;
  return (
    <>
      <MobileHeaderBar title={heading} isRoot={state.isRoot} />
      {href ? (
        <PageStyle
          css={`
            .lm-dnav a[href="${href}"] {
              border-bottom-color: var(--lamsa-accent);
            }
            .lm-dnav a[href="${href}"]:not(.sale) {
              color: var(--lamsa-ink);
            }
          `}
        />
      ) : null}
      <div className="lm-pg">
        {width === "narrow" ? (
          <div className="lm-auth">{children}</div>
        ) : (
          children
        )}
      </div>
    </>
  );
}
