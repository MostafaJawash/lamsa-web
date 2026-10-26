import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageChrome } from "@/components/layout/page-chrome";
import { EmptyState } from "@/components/shared/empty-state";
import { BagIcon } from "@/components/shared/icons";
import { JsonLd } from "@/components/shared/json-ld";
import { tabForCategory } from "@/config/site";
import { CategoryChips } from "@/features/catalog/components/category-chips";
import {
  ListPreview,
  ListResults,
  requirePage,
  type ListSearchParams,
} from "@/features/catalog/components/list-results";
import { getCategory } from "@/features/catalog/queries";
import { breadcrumbJsonLd, listMetadata } from "@/features/catalog/seo";
import { t } from "@/i18n";

/** Metadata of page `page` of a category (no search params: it stays in the static <head>). */
export async function categoryMetadata(
  slug: string,
  page: number,
): Promise<Metadata> {
  const result = await getCategory(slug);
  if (result.status !== "ok") return { title: t("pages.category") };
  const category = result.data;
  return listMetadata({
    title: category.name,
    description: category.description ?? "",
    basePath: `/c/${encodeURIComponent(category.slug)}`,
    page,
    image: category.image?.large ?? null,
  });
}

/** Category list (prototype `pList()` for a category): `/c/[slug]` and `/c/[slug]/page/[n]`. */
export async function CategoryList({
  slug,
  page,
  searchParams,
}: {
  slug: string;
  page: number;
  searchParams: Promise<ListSearchParams>;
}) {
  const result = await getCategory(slug);
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return (
      <PageChrome path="/c/[slug]">
        <EmptyState
          icon={<BagIcon />}
          title={t("list.unavailable")}
          text={t("list.unavailableText")}
        />
      </PageChrome>
    );
  }
  const category = result.data;
  const scope = { kind: "category", slug: category.slug } as const;
  await requirePage(scope, page);
  const basePath = `/c/${encodeURIComponent(category.slug)}`;
  const trail = category.breadcrumb.filter((c) => c.slug !== category.slug);
  const tab = tabForCategory(trail[0]?.slug ?? category.slug);
  const list = {
    scope,
    basePath,
    title: category.name,
    sub: category.description ?? "",
    category,
    page,
    emptyTitle: t("list.emptyCategory"),
  };
  return (
    <PageChrome path="/c/[slug]" title={category.name} activeTab={tab}>
      <CategoryChips active={tab} />
      <Suspense fallback={<ListPreview {...list} />}>
        <ListResults {...list} searchParams={searchParams} />
      </Suspense>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("product.crumbHome"), path: "/" },
          ...trail.map((c) => ({
            name: c.name,
            path: `/c/${encodeURIComponent(c.slug)}`,
          })),
          { name: category.name, path: basePath },
        ])}
      />
    </PageChrome>
  );
}
