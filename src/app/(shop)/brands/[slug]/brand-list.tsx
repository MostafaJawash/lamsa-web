import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageChrome } from "@/components/layout/page-chrome";
import { EmptyState } from "@/components/shared/empty-state";
import { BagIcon } from "@/components/shared/icons";
import { BrandHero } from "@/features/catalog/components/brand-hero";
import { CategoryChips } from "@/features/catalog/components/category-chips";
import {
  ListPreview,
  ListResults,
  requirePage,
  type ListSearchParams,
} from "@/features/catalog/components/list-results";
import { getBrand } from "@/features/catalog/queries";
import { listMetadata } from "@/features/catalog/seo";
import { t } from "@/i18n";

/** Metadata of page `page` of a brand (no search params: it stays in the static <head>). */
export async function brandMetadata(
  slug: string,
  page: number,
): Promise<Metadata> {
  const result = await getBrand(slug);
  if (result.status !== "ok") return { title: t("pages.brand") };
  const brand = result.data;
  return listMetadata({
    title: brand.name,
    description: brand.description ?? "",
    basePath: `/brands/${encodeURIComponent(brand.slug)}`,
    page,
    image: brand.logo?.large ?? null,
  });
}

/**
 * Brand list (prototype `pList()` for a brand: brand hero, no brand select):
 * `/brands/[slug]` and `/brands/[slug]/page/[n]`.
 */
export async function BrandList({
  slug,
  page,
  searchParams,
}: {
  slug: string;
  page: number;
  searchParams: Promise<ListSearchParams>;
}) {
  const result = await getBrand(slug);
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return (
      <PageChrome path="/brands/[slug]">
        <EmptyState
          icon={<BagIcon />}
          title={t("list.unavailable")}
          text={t("list.unavailableText")}
        />
      </PageChrome>
    );
  }
  const brand = result.data;
  const scope = { kind: "brand", slug: brand.slug } as const;
  await requirePage(scope, page);
  const list = {
    scope,
    basePath: `/brands/${encodeURIComponent(brand.slug)}`,
    title: null,
    page,
    emptyTitle: t("list.emptyBrand"),
  };
  return (
    <PageChrome path="/brands/[slug]" title={brand.name}>
      <CategoryChips active="/brands" />
      <BrandHero brand={brand} />
      <Suspense fallback={<ListPreview {...list} />}>
        <ListResults {...list} searchParams={searchParams} />
      </Suspense>
    </PageChrome>
  );
}
