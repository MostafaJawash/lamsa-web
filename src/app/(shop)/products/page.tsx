import type { Metadata } from "next";

import {
  FlagList,
  flagListMetadata,
} from "@/features/catalog/components/flag-list";

export const metadata: Metadata = flagListMetadata("all", 1);

/** "كل المنتجات", page 1: the whole catalog, unfiltered. */
export default function AllProductsPage({
  searchParams,
}: PageProps<"/products">) {
  return <FlagList kind="all" page={1} searchParams={searchParams} />;
}
