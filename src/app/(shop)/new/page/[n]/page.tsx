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
  const pages = laterPages(index.status === "ok" ? index.data.newCount : 0);
  return pages.length ? pages.map((n) => ({ n: String(n) })) : [{ n: "2" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/new/page/[n]">): Promise<Metadata> {
  const page = pageFromSegment((await params).n);
  return page ? flagListMetadata("new", page) : {};
}

/** `/new/page/[n]`: page 2+ of "جديد" (page 1 is `/new`). */
export default async function NewPageN({
  params,
  searchParams,
}: PageProps<"/new/page/[n]">) {
  const page = pageFromSegment((await params).n);
  if (!page) notFound();
  return <FlagList kind="new" page={page} searchParams={searchParams} />;
}
