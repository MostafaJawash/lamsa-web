import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { laterPages, pageFromSegment } from "@/features/catalog/filters";
import { getCatalogIndex } from "@/features/catalog/queries";

import { CategoryList, categoryMetadata } from "../../category-list";

/** Pages 2+ of every category (bounded); at least one entry, as Cache Components require. */
export async function generateStaticParams(): Promise<
  { slug: string; n: string }[]
> {
  const index = await getCatalogIndex();
  const categories = index.status === "ok" ? index.data.categories : [];
  const params = categories.flatMap(({ slug, count }) =>
    laterPages(count).map((n) => ({ slug, n: String(n) })),
  );
  return params.length
    ? params
    : [{ slug: categories[0]?.slug ?? "makeup", n: "2" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/c/[slug]/page/[n]">): Promise<Metadata> {
  const { slug, n } = await params;
  const page = pageFromSegment(n);
  return page ? categoryMetadata(slug, page) : {};
}

/**
 * Opted out of instant-navigation validation (Next.js "block" fix). The whole page, down to
 * its title, 404 decision and JSON-LD, is derived from the slug (URL data), so streaming it
 * would leave only a skeleton in the shell, and the catalog pages' static shell must hold the
 * real content without JavaScript (a streamed boundary stays hidden there). Known slugs are
 * prerendered, and everything the page reads is cached.
 */
export const instant = false;

/** `/c/[slug]/page/[n]`: page 2+ of a category (page 1 is `/c/[slug]`). */
export default async function CategoryPageN({
  params,
  searchParams,
}: PageProps<"/c/[slug]/page/[n]">) {
  const { slug, n } = await params;
  const page = pageFromSegment(n);
  if (!page) notFound();
  return <CategoryList slug={slug} page={page} searchParams={searchParams} />;
}
