"use client";

import { useEffect } from "react";

import { defaultLocale, getDirection, t } from "@/i18n";

import "./globals.css";

/**
 * Replaces the root layout when it fails, so it renders its own <html> and <body>
 * and must not depend on the layout's fonts or providers (system fonts here).
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={defaultLocale} dir={getDirection(defaultLocale)}>
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <title>{t("errors.errorTitle")}</title>
        <h1 className="text-3xl font-semibold">{t("errors.errorTitle")}</h1>
        <p className="text-ink-muted">{t("errors.errorBody")}</p>
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
        >
          {t("common.retry")}
        </button>
      </body>
    </html>
  );
}
