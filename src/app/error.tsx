"use client";

import Link from "next/link";
import { useEffect } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { XIcon } from "@/components/shared/icons";
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
    <div className="lm-pg">
      <EmptyState
        icon={<XIcon />}
        title={t("errors.errorTitle")}
        text={t("errors.errorBody")}
        action={
          <div className="flex justify-center gap-3">
            <button
              type="button"
              className="lm-btn primary"
              onClick={() => retry()}
            >
              {t("common.retry")}
            </button>
            <Link href="/" className="lm-btn ghost">
              {t("common.backHome")}
            </Link>
          </div>
        }
      />
    </div>
  );
}
