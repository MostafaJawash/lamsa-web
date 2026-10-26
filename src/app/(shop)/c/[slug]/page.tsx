import type { Metadata } from "next";

import { getCatalogIndex } from "@/features/catalog/queries";

import { CategoryList, categoryMetadata } from "./category-list";

/** Categories are few: all of them prerendered (from the catalog index). */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const index = await getCatalogIndex();
  const slugs =
    index.status === "ok"
      ? index.data.categories.map(({ slug }) => ({ slug }))
      : [];
  return slugs.length ? slugs : [{ slug: "makeup" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/c/[slug]">): Promise<Metadata> {
  return categoryMetadata((await params).slug, 1);
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/c/[slug]">) {
  return (
    <CategoryList
      slug={(await params).slug}
      page={1}
      searchParams={searchParams}
    />
  );
}
