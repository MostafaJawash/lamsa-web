import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Reem_Kufi } from "next/font/google";

import { DeferredToaster } from "@/components/layout/deferred-toaster";
import { SiteShell } from "@/components/layout/site-shell";
import { IMAGE_FALLBACK_SCRIPT } from "@/components/shared/backend-image";
import { siteConfig } from "@/config/site";
import { defaultLocale, getDirection, t } from "@/i18n";

import "./globals.css";

/**
 * Fonts, as used by the prototype CSS. `subsets` selects the preloaded files (the
 * @font-face rules cover every subset). Body font: the four weights the prototype uses,
 * Arabic + Latin preloaded: Latin covers digits, prices and spaces, which every page shows
 * before its first paint (left to CSS discovery they load at top priority after the CSS).
 */
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Tahoma", "sans-serif"],
});

/** Display font: only 600 and 700 are used (logo, banner titles, page titles); not preloaded. */
const reemKufi = Reem_Kufi({
  variable: "--font-reem-kufi",
  subsets: ["arabic"],
  weight: ["600", "700"],
  display: "swap",
  preload: false,
  fallback: ["Tahoma", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    locale: "ar_AR",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: siteConfig.themeColor.light,
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: siteConfig.themeColor.dark,
    },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  // Content may extend under notches; the mobile header and tabbar pad with env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={defaultLocale}
      dir={getDirection(defaultLocale)}
      className={`${plexArabic.variable} ${reemKufi.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        {/* Hides failed backend images so their fallback shows (non-blocking module). */}
        <script
          type="module"
          dangerouslySetInnerHTML={{ __html: IMAGE_FALLBACK_SCRIPT }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          {t("nav.skipToContent")}
        </a>
        <SiteShell>{children}</SiteShell>
        <DeferredToaster />
      </body>
    </html>
  );
}
