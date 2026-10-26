import type { Metadata } from "next";

import {
  FlagList,
  flagListMetadata,
} from "@/features/catalog/components/flag-list";

export const metadata: Metadata = flagListMetadata("sale", 1);

/** "تنزيلات", page 1. */
export default function SalePage({ searchParams }: PageProps<"/sale">) {
  return <FlagList kind="sale" page={1} searchParams={searchParams} />;
}
