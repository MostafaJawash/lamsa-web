import type { Metadata } from "next";

import {
  FlagList,
  flagListMetadata,
} from "@/features/catalog/components/flag-list";

export const metadata: Metadata = flagListMetadata("new", 1);

/** "جديد", page 1. */
export default function NewPage({ searchParams }: PageProps<"/new">) {
  return <FlagList kind="new" page={1} searchParams={searchParams} />;
}
