import type { Metadata, Route } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import { PageChrome } from "@/components/layout/page-chrome";
import {
  ListResults,
  ListSkeleton,
  type ListSearchParams,
} from "@/features/catalog/components/list-results";
import { parseFilters, value } from "@/features/catalog/filters";
import { t } from "@/i18n";

export const metadata: Metadata = {
  title: t("pages.search"),
  robots: { index: false, follow: true },
  alternates: { canonical: "/search" },
};

const SUGGESTIONS = ["lipstick", "shampoo", "perfume", "sidr"] as const;

async function SearchBody({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>;
}) {
  const params = await searchParams;
  const q = value(parseFilters(params, { kind: "search" }), "q");
  return (
    <>
      {/* Prototype mobile search page: .m-sbox (desktop uses the header search). */}
      <Form action="/search" className="lm-msbox md:hidden" role="search">
        <input
          className="lm-inp"
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("layout.searchPlaceholder")}
          aria-label={t("layout.search")}
          enterKeyHint="search"
          autoComplete="off"
        />
        <button type="submit" className="lm-btn primary">
          {t("layout.searchSubmit")}
        </button>
      </Form>
      {q ? (
        <ListResults
          scope={{ kind: "search" }}
          basePath="/search"
          title={t("search.title", { q })}
          searchParams={searchParams}
          emptyTitle={t("search.emptyTitle")}
        />
      ) : (
        <p className="lm-sub">
          {t("search.hint")}{" "}
          {SUGGESTIONS.map((key) => {
            const term = t(`search.suggestions.${key}`);
            return (
              <Link
                key={key}
                href={`/search?q=${encodeURIComponent(term)}` as Route}
                className="lm-chip"
              >
                {term}
              </Link>
            );
          })}
        </p>
      )}
    </>
  );
}

/** "البحث" (prototype `pList()` for route "search"). */
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <PageChrome path="/search">
      <Suspense fallback={<ListSkeleton title={null} />}>
        <SearchBody searchParams={searchParams} />
      </Suspense>
    </PageChrome>
  );
}
