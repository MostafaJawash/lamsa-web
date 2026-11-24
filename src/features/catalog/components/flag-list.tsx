import type { Metadata, Route } from "next";
import { Suspense } from "react";

import { PageChrome } from "@/components/layout/page-chrome";
import { t } from "@/i18n";

import { listMetadata } from "../seo";

import { CategoryChips } from "./category-chips";
import {
  ListPreview,
  ListResults,
  requirePage,
  type ListSearchParams,
} from "./list-results";

type Flag = "new" | "sale" | "all";

/** `/new`, `/sale`, `/products`. */
const basePathOf = (kind: Flag) => (kind === "all" ? "/products" : `/${kind}`);

const TEXT = {
  new: {
    title: () => t("pages.new"),
    sub: () => t("list.subNew"),
    empty: () => t("list.emptyNew"),
  },
  sale: {
    title: () => t("pages.sale"),
    sub: () => t("list.subSale"),
    empty: () => t("list.emptySale"),
  },
  all: {
    title: () => t("pages.allProducts"),
    sub: () => t("list.subAll"),
    empty: () => t("list.emptyAll"),
  },
} as const;

/** Metadata of page `page` of "جديد" or "التخفيضات" (static: no search params). */
export function flagListMetadata(kind: Flag, page: number): Metadata {
  return listMetadata({
    title: TEXT[kind].title(),
    description: TEXT[kind].sub(),
    basePath: basePathOf(kind),
    page,
  });
}

/**
 * "جديد" and "التخفيضات" (prototype `pList()` for new arrivals and the sale):
 * `/new`, `/sale` and their `/page/[n]` pages.
 */
export async function FlagList({
  kind,
  page,
  searchParams,
}: {
  kind: Flag;
  page: number;
  searchParams: Promise<ListSearchParams>;
}) {
  const scope = { kind } as const;
  await requirePage(scope, page);
  const list = {
    scope,
    basePath: basePathOf(kind),
    title: TEXT[kind].title(),
    sub: TEXT[kind].sub(),
    page,
    emptyTitle: TEXT[kind].empty(),
  };
  return (
    <PageChrome path={basePathOf(kind)}>
      <CategoryChips
        active={kind === "all" ? null : (basePathOf(kind) as Route)}
      />
      <Suspense fallback={<ListPreview {...list} />}>
        <ListResults {...list} searchParams={searchParams} />
      </Suspense>
    </PageChrome>
  );
}
