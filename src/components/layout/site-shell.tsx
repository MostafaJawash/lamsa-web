import { Suspense } from "react";

import { BackendNotice } from "./backend-notice";
import { DesktopHeader } from "./desktop-header";
import { Footer } from "./footer";
import { MobileHeader, MobileHeaderFallback } from "./mobile-header";
import { Tabbar, TabbarView } from "./tabbar";

/**
 * Site chrome for every page. Breakpoint 768px: below it the prototype mobile app
 * (m-head + fixed tabbar), from it the desktop site (d-bar + d-nav + d-foot). Both are
 * in the HTML; CSS shows one, so nothing depends on the user agent.
 *
 * The pathname-aware parts (active tab, mobile title) sit in <Suspense>: static routes
 * prerender them complete; dynamic routes show a same-size fallback until hydration.
 *
 * Keep it static: session-dependent UI (account name, badges) must render inside
 * <Suspense> once auth exists.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {process.env.NODE_ENV === "development" ? (
        <Suspense fallback={null}>
          <BackendNotice />
        </Suspense>
      ) : null}
      <DesktopHeader />
      <Suspense fallback={<MobileHeaderFallback />}>
        <MobileHeader />
      </Suspense>
      <main id="main" className="lm-main">
        {children}
      </main>
      <Footer />
      <Suspense fallback={<TabbarView active={null} />}>
        <Tabbar />
      </Suspense>
    </>
  );
}
