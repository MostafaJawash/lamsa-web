import { Suspense } from "react";

import { SilhouetteSymbol } from "@/components/shared/product-art";

import { BackendNotice } from "./backend-notice";
import { DesktopHeader } from "./desktop-header";
import { Footer } from "./footer";
import { TabbarView } from "./tabbar";
import { TabbarLive } from "./tabbar-live";

/**
 * Site chrome for every page. Breakpoint 768px: below it the prototype mobile app
 * (m-head + fixed tabbar), from it the desktop site (d-bar + d-nav + d-foot). Both are
 * in the HTML; CSS shows one, so nothing depends on the user agent.
 *
 * Per-page chrome (mobile header with the real title, desktop active tab, the content
 * box) comes from each page through `PageChrome`. The tabbar reads the pathname inside
 * <Suspense> (same-size fallback on dynamic routes).
 *
 * Keep it static: session-dependent UI renders inside small <Suspense> holes whose
 * fallback is the guest version at the same size (the desktop account entry, the
 * tabbar's account link), so the shell is prerendered and nothing moves.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SilhouetteSymbol />
      {process.env.NODE_ENV === "development" ? (
        <Suspense fallback={null}>
          <BackendNotice />
        </Suspense>
      ) : null}
      <DesktopHeader />
      <main id="main" className="lm-main">
        {children}
      </main>
      <Footer />
      <Suspense fallback={<TabbarView active={null} accountHref="/account" />}>
        <TabbarLive />
      </Suspense>
    </>
  );
}
