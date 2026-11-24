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

/**
 * Opted out of instant-navigation validation (Next.js "block" fix). The whole page, down to
 * its title, 404 decision and JSON-LD, is derived from the slug (URL data), so streaming it
 * would leave only a skeleton in the shell, and the catalog pages' static shell must hold the
 * real content without JavaScript (a streamed boundary stays hidden there). Known slugs are
 * prerendered, and everything the page reads is cached.
 */
export const instant = false;

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
