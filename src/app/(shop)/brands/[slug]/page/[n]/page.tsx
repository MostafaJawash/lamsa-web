import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { laterPages, pageFromSegment } from "@/features/catalog/filters";
import { getCatalogIndex } from "@/features/catalog/queries";

import { BrandList, brandMetadata } from "../../brand-list";

/** Pages 2+ of every brand (bounded); at least one entry, as Cache Components require. */
export async function generateStaticParams(): Promise<
  { slug: string; n: string }[]
> {
  const index = await getCatalogIndex();
  const brands = index.status === "ok" ? index.data.brands : [];
  const params = brands.flatMap(({ slug, count }) =>
    laterPages(count).map((n) => ({ slug, n: String(n) })),
  );
  return params.length
    ? params
    : [{ slug: brands[0]?.slug ?? "brand", n: "2" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/brands/[slug]/page/[n]">): Promise<Metadata> {
  const { slug, n } = await params;
  const page = pageFromSegment(n);
  return page ? brandMetadata(slug, page) : {};
}

/** `/brands/[slug]/page/[n]`: page 2+ of a brand (page 1 is `/brands/[slug]`). */
export default async function BrandPageN({
  params,
  searchParams,
}: PageProps<"/brands/[slug]/page/[n]">) {
  const { slug, n } = await params;
  const page = pageFromSegment(n);
  if (!page) notFound();
  return <BrandList slug={slug} page={page} searchParams={searchParams} />;
}
