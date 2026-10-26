import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageChrome } from "@/components/layout/page-chrome";
import { BrandLogo } from "@/components/shared/brand-logo";
import { EmptyState } from "@/components/shared/empty-state";
import { BagIcon } from "@/components/shared/icons";
import { CategoryChips } from "@/features/catalog/components/category-chips";
import { getBrands } from "@/features/catalog/queries";
import { listMetadata } from "@/features/catalog/seo";
import { t } from "@/i18n";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = listMetadata({
  title: t("pages.brands"),
  description: t("site.description"),
  basePath: "/brands",
  page: 1,
});

async function BrandGrid() {
  const result = await getBrands();
  if (result.status !== "ok") {
    return (
      <>
        <div className="lm-list-head">
          <h1>{t("pages.brands")}</h1>
        </div>
        <EmptyState
          icon={<BagIcon />}
          title={
            result.status === "empty"
              ? t("list.emptyBrand")
              : t("list.unavailable")
          }
          text={
            result.status === "empty" ? undefined : t("list.unavailableText")
          }
        />
      </>
    );
  }
  return (
    <>
      <div className="lm-list-head">
        <h1>{t("pages.brands")}</h1>
        <span className="lm-count">
          {pluralize(result.data.length, "brands")}
        </span>
      </div>
      <div className="lm-brand-grid">
        {result.data.map((brand) => (
          <Link
            key={brand.id}
            href={`/brands/${encodeURIComponent(brand.slug)}` as Route}
            className="lm-brand-card"
          >
            <BrandLogo
              id={brand.id}
              name={brand.name}
              logo={brand.logo}
              large
            />
            <span className="bn">{brand.name}</span>
            <span className="bc">
              {pluralize(brand.product_count, "products")}
            </span>
            {brand.is_own_brand ? (
              <i className="lm-bd own">{t("brands.own")}</i>
            ) : null}
          </Link>
        ))}
      </div>
    </>
  );
}

/** "الماركات" (prototype `pBrands()`). */
export default function BrandsPage() {
  return (
    <PageChrome path="/brands">
      <CategoryChips active="/brands" />
      <Suspense
        fallback={
          <div className="lm-list-head">
            <h1>{t("pages.brands")}</h1>
          </div>
        }
      >
        <BrandGrid />
      </Suspense>
    </PageChrome>
  );
}
