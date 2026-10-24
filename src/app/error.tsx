"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // TODO: report to an error tracker once one is chosen.
    console.error(error);
  }, [error]);

  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center"
    >
      <h1 className="text-3xl font-semibold">{t("errors.errorTitle")}</h1>
      <p className="text-ink-muted">{t("errors.errorBody")}</p>
      <div className="flex gap-3">
        <Button onClick={() => retry()}>{t("common.retry")}</Button>
        <Button variant="outline" asChild>
          <Link href="/">{t("common.backHome")}</Link>
        </Button>
      </div>
    </main>
  );
}
