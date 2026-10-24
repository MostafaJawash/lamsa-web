import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { SearchIcon } from "@/components/shared/icons";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("errors.notFoundTitle") };

/** Unknown routes: the prototype `.empty-st` inside the site chrome. */
export default function NotFound() {
  return (
    <div className="lm-pg">
      <EmptyState
        icon={<SearchIcon />}
        title={t("errors.notFoundTitle")}
        text={t("errors.notFoundBody")}
        action={
          <Link href="/" className="lm-btn primary">
            {t("common.backHome")}
          </Link>
        }
      />
    </div>
  );
}
