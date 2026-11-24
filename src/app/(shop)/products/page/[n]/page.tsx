import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  FlagList,
  flagListMetadata,
} from "@/features/catalog/components/flag-list";
import { laterPages, pageFromSegment } from "@/features/catalog/filters";
import { getCatalogIndex } from "@/features/catalog/queries";

/** Pages 2+ (bounded); at least one entry, as Cache Components require. */
export async function generateStaticParams(): Promise<{ n: string }[]> {
  const index = await getCatalogIndex();
  const pages = laterPages(
    index.status === "ok" ? index.data.products.length : 0,
  );
  return pages.length ? pages.map((n) => ({ n: String(n) })) : [{ n: "2" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/products/page/[n]">): Promise<Metadata> {
  const page = pageFromSegment((await params).n);
  return page ? flagListMetadata("all", page) : {};
}

/** `/products/page/[n]`: page 2+ of "كل المنتجات" (page 1 is `/products`). */
export default async function AllProductsPageN({
  params,
  searchParams,
}: PageProps<"/products/page/[n]">) {
  const page = pageFromSegment((await params).n);
  if (!page) notFound();
  return <FlagList kind="all" page={page} searchParams={searchParams} />;
}
