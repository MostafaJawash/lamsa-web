"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { t } from "@/i18n";

import {
  cleared,
  hrefWith,
  parseFilters,
  pricePreset,
  setValue,
  value,
  values,
  withPricePreset,
  type ListFilters,
  type ListScope,
  type PricePreset,
} from "../filters";
import type { Facets } from "../types";

import { FilterPanel } from "./filter-panel";

type FilterControlsProps = {
  scope: ListScope;
  basePath: string;
  filters: ListFilters;
  facets: Facets | null;
  showBrandSelect: boolean;
  /** The "المزيد من الفلاتر" button (only when there are facets beyond brand/price). */
  showMore: boolean;
  /** Filters that narrow the result (badge on the button). */
  activeCount: number;
  /** No-JS link to the inline panel (`?filters=1`). */
  moreHref: string;
};

const MANY = "__many";

/** Scrolls to the top of the results if the visitor is below it. */
function scrollToResults(): void {
  const results = document.getElementById("lm-results");
  if (results && results.getBoundingClientRect().top < 0) {
    results.scrollIntoView({ block: "start" });
  }
}

/**
 * The list page's interactive filters: the prototype `.selects` row and the filter Sheet.
 * Every change navigates to the new URL (no scroll jump), so the server renders the
 * result and back/forward work. Without JavaScript the same markup is a GET form and the
 * button is a link to the inline panel.
 */
export function FilterControls({
  scope,
  basePath,
  filters,
  facets,
  showBrandSelect,
  showMore,
  activeCount,
  moreHref,
}: FilterControlsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"end" | "bottom">("bottom");

  const go = (next: ListFilters) => {
    router.push(hrefWith(basePath, next) as Route, { scroll: false });
    scrollToResults();
  };

  const brands = values(filters, "brand");
  const brandValue = brands.length > 1 ? MANY : (brands[0] ?? "");
  const preset = pricePreset(filters);
  const sort =
    value(filters, "sort") ??
    (scope.kind === "search" ? "relevance" : "newest");
  const clearHref = hrefWith(basePath, cleared(filters, scope));

  // Pairs the selects don't show, kept as hidden fields for the no-JS form.
  const hidden = filters.filter(([name]) => {
    if (name === "sort" || name === "page") return false;
    if (name === "brand") return showBrandSelect && brandValue === MANY;
    if (name === "min_price" || name === "max_price")
      return preset === "custom";
    return true;
  });

  return (
    <>
      <form method="get" action={basePath} className="lm-selects">
        {hidden.map(([name, val]) => (
          <input key={`${name}=${val}`} type="hidden" name={name} value={val} />
        ))}
        {showBrandSelect ? (
          <label className="lm-sel">
            <span>{t("list.brand")}</span>
            <select
              name={brandValue === MANY ? undefined : "brand"}
              defaultValue={brandValue}
              onChange={(e) =>
                go(setValue(filters, "brand", e.target.value || null, scope))
              }
            >
              <option value="">{t("list.all")}</option>
              {brandValue === MANY ? (
                <option value={MANY} disabled>
                  {t("list.brandMany")}
                </option>
              ) : null}
              {(facets?.brands ?? []).map((brand) => (
                <option key={brand.slug} value={brand.slug}>
                  {brand.name} ({brand.count})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="lm-sel">
          <span>{t("list.price")}</span>
          <select
            name="price"
            defaultValue={preset ?? ""}
            onChange={(e) => {
              const next = e.target.value;
              if (next === "custom") return;
              go(
                withPricePreset(
                  filters,
                  next ? (next as PricePreset) : null,
                  scope,
                ),
              );
            }}
          >
            <option value="">{t("list.all")}</option>
            <option value="lt5">{t("list.priceLt5")}</option>
            <option value="5to15">{t("list.price5to15")}</option>
            <option value="gt15">{t("list.priceGt15")}</option>
            {preset === "custom" ? (
              <option value="custom" disabled>
                {t("list.priceCustom")}
              </option>
            ) : null}
          </select>
        </label>
        <label className="lm-sel">
          <span>{t("list.sort")}</span>
          <select
            name="sort"
            defaultValue={sort}
            onChange={(e) =>
              go(setValue(filters, "sort", e.target.value, scope))
            }
          >
            {scope.kind === "search" ? (
              <option value="relevance">{t("list.sortRelevance")}</option>
            ) : null}
            <option value="newest">{t("list.sortNewest")}</option>
            <option value="price_asc">{t("list.sortPriceAsc")}</option>
            <option value="price_desc">{t("list.sortPriceDesc")}</option>
          </select>
        </label>
        <noscript>
          <button type="submit" className="lm-btn ghost sm">
            {t("list.apply")}
          </button>
        </noscript>
        {showMore && facets ? (
          <a
            href={moreHref}
            className="lm-chip lm-more-filters"
            onClick={(e) => {
              e.preventDefault();
              setSide(
                window.matchMedia("(min-width: 768px)").matches
                  ? "end"
                  : "bottom",
              );
              setOpen(true);
            }}
          >
            {t("list.moreFilters")}
            {activeCount > 0 ? <i className="lm-badge">{activeCount}</i> : null}
          </a>
        ) : null}
      </form>

      {showMore && facets ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side={side}
            className={
              side === "bottom"
                ? "max-h-[85dvh] gap-0 rounded-t-[22px] p-0"
                : "w-full gap-0 p-0 sm:max-w-md"
            }
          >
            <SheetHeader className="border-b border-line">
              <SheetTitle>{t("list.filtersTitle")}</SheetTitle>
              <SheetDescription className="sr-only">
                {t("list.moreFilters")}
              </SheetDescription>
            </SheetHeader>
            <div
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const params = new URLSearchParams();
                for (const [name, val] of new FormData(form)) {
                  if (typeof val === "string") params.append(name, val);
                }
                setOpen(false);
                go(parseFilters(params, scope));
              }}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest("[data-clear-filters]")) {
                  e.preventDefault();
                  setOpen(false);
                  go(cleared(filters, scope));
                }
              }}
            >
              <FilterPanel
                basePath={basePath}
                filters={filters}
                facets={facets}
                showBrands={scope.kind !== "brand"}
                showOnSale={scope.kind !== "sale"}
                clearHref={clearHref}
                formId="lm-filter-sheet"
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}
