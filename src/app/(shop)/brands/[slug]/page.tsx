import type { Metadata } from "next";

import { getCatalogIndex } from "@/features/catalog/queries";

import { BrandList, brandMetadata } from "./brand-list";

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const index = await getCatalogIndex();
  const slugs =
    index.status === "ok"
      ? index.data.brands.map(({ slug }) => ({ slug }))
      : [];
  return slugs.length ? slugs : [{ slug: "brand" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/brands/[slug]">): Promise<Metadata> {
  return brandMetadata((await params).slug, 1);
}

export default async function BrandPage({
  params,
  searchParams,
}: PageProps<"/brands/[slug]">) {
  return (
    <BrandList
      slug={(await params).slug}
      page={1}
      searchParams={searchParams}
    />
  );
}
