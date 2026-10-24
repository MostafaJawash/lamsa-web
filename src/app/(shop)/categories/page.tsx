import type { Metadata } from "next";
import { Suspense } from "react";

import { TilesSkeleton } from "@/components/shared/skeletons";
import { CategoriesGrid } from "@/features/catalog/components/categories-grid";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("pages.categories") };

/** "الأقسام" tab (prototype `pCats()`). */
export default function CategoriesPage() {
  return (
    <>
      <h1 className="sr-only">{t("pages.categories")}</h1>
      <Suspense fallback={<TilesSkeleton count={6} />}>
        <CategoriesGrid />
      </Suspense>
    </>
  );
}
