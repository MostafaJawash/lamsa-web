import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SearchIcon, XIcon, BagIcon } from "@/components/shared/icons";
import { ProductCard } from "@/components/shared/product-card";
import { t } from "@/i18n";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

import { filterChips } from "../filter-labels";
import {
  activeFilters,
  cleared,
  currentPage,
  hrefWith,
  PAGE_SIZE,
  parseFilters,
  serializeFilters,
  setValue,
  value,
  withPage,
  type ListFilters,
  type ListScope,
} from "../filters";
import { getFacets, getProductList } from "../queries";
import type { AttributeFacet, CategoryDetail } from "../types";

import { FilterControls } from "./filter-controls";
import { FilterPanel } from "./filter-panel";

const NO_JS_FILTERS = "lm-filters";

export type ListSearchParams = Record<string, string | string[] | undefined>;

export type ListResultsProps = {
  scope: ListScope;
  basePath: string;
  /** Title of the list head; null hides it (the brand page has its own hero). */
  title: string | null;
  sub?: string | null;
  /** Category: child categories and the primary attribute chips. */
  category?: CategoryDetail | null;
  searchParams: Promise<ListSearchParams>;
  /** Page number from the path (`/page/[n]`); omitted on page 1 and on search (?page). */
  page?: number;
  /** Empty state without filters. */
  emptyTitle: string;
};

/**
 * Page 2+ (`/page/[n]`) past the end of the unfiltered list renders the 404 page. Call it
 * in the page itself (prerendered), not inside the streamed list.
 */
export async function requirePage(scope: ListScope, page: number) {
  if (page <= 1) return;
  const list = await getProductList(scope, withPage([], page, scope));
  if (list.status === "ok" && list.data.page.items.length === 0) notFound();
}

/** The first filterable select attribute: the prototype "types" chips row. */
function primaryAttribute(
  category: CategoryDetail | null | undefined,
  facets: AttributeFacet[],
): { key: string; label: string; options: string[] } | null {
  if (!category) return null;
  const def = category.attributes.find(
    (a) => a.type === "select" || a.type === "multiselect",
  );
  if (!def) return null;
  const facet = facets.find((f) => f.key === def.key);
  const options = facet?.values?.map((v) => v.value) ?? def.options ?? [];
  return options.length ? { key: def.key, label: def.label, options } : null;
}

/** Prototype-styled pagination: السابق / numbers / التالي, plain links (works without JS). */
export function Pager({
  basePath,
  filters,
  scope,
  total,
}: {
  basePath: string;
  filters: ListFilters;
  scope: ListScope;
  total: number;
}) {
  return (
    <PagerLinks
      page={currentPage(filters)}
      pages={Math.ceil(total / PAGE_SIZE)}
      href={(n) =>
        `${hrefWith(basePath, withPage(filters, n, scope))}#lm-results` as Route
      }
    />
  );
}

/** The pager itself, for any paginated page (lists, favorites). */
export function PagerLinks({
  page: requested,
  pages,
  href,
}: {
  page: number;
  pages: number;
  href: (page: number) => Route;
}) {
  if (pages <= 1) return null;
  const page = Math.min(requested, pages);
  const numbers = new Set<number>([1, pages, page - 1, page, page + 1]);
  const list = [...numbers]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  return (
    <nav className="lm-pager" aria-label={t("list.pagination")}>
      <Link
        href={href(page - 1)}
        className="lm-chip"
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
        rel="prev"
      >
        {t("list.prev")}
      </Link>
      {list.map((n, i) => (
        <span key={n} className="contents">
          {i > 0 && n - (list[i - 1] ?? n) > 1 ? (
            <span className="lm-count self-center" aria-hidden="true">
              …
            </span>
          ) : null}
          <Link
            href={href(n)}
            className={cn("lm-chip", n === page && "on")}
            aria-current={n === page ? "page" : undefined}
            aria-label={t("list.page", { page: n })}
          >
            <span className="lm-num">{n}</span>
          </Link>
        </span>
      ))}
      <Link
        href={href(page + 1)}
        className="lm-chip"
        aria-disabled={page >= pages}
        tabIndex={page >= pages ? -1 : undefined}
        rel="next"
      >
        {t("list.next")}
      </Link>
    </nav>
  );
}

/**
 * Body of every list page (prototype `pList()`): list head with the count, the type
 * chips, the selects and filter sheet, active filter chips, the grid, empty states and
 * pagination. Reads the URL (search params), so it renders inside <Suspense>.
 */
export async function ListResults({
  searchParams,
  ...props
}: ListResultsProps) {
  const params = await searchParams;
  const parsed = parseFilters(params, props.scope);
  return (
    <ListContent
      {...props}
      requested={
        props.page === undefined
          ? parsed
          : withPage(parsed, props.page, props.scope)
      }
      inlinePanel={params.filters === "1"}
      preview={false}
    />
  );
}

/**
 * Runs while the HTML is parsed (before the first paint): if the URL asks for something
 * the unfiltered preview does not show, the preview is marked pending (dimmed, loading
 * bar, aria-busy) until the streamed result replaces it. Mirrors `parseFilters` loosely:
 * a false positive only shows the indicator for the streaming time.
 */
const PENDING_SCRIPT = `(function(){var b=document.currentScript.parentElement;var p=new URLSearchParams(location.search);var n=0;p.forEach(function(v,k){if(k==="filters"||k==="q"||!v)return;if(k==="sort"&&v==="newest")return;if(k==="page"&&v==="1")return;if(/^(sort|page|brand|min_price|max_price|price|on_sale)$|^(attr|opt)\\./.test(k))n++;});if(n){b.setAttribute("data-pending","");b.setAttribute("aria-busy","true");}})();`;

/**
 * The Suspense fallback of category, brand, new and sale lists: the unfiltered first
 * page. It needs no URL, so it is part of the prerendered shell: visible without
 * JavaScript (streamed boundaries are revealed by a script) and on a hard load until
 * the filtered result streams in. Without JavaScript the full filter form is offered
 * below the results (the `?filters=1` panel lives in the streamed part).
 *
 * No boundary of its own: React streams a large completed boundary separately (revealed
 * by a script), which would hide the preview without JavaScript. The page wraps its body
 * in a <Suspense> instead, which catches a backend failure while prerendering (cached
 * only briefly, so a request-time hole) and keeps the build working.
 */
export function ListPreview(props: Omit<ListResultsProps, "searchParams">) {
  return (
    <div className="contents" data-list-preview="">
      {/* First child: it runs before any of the preview is painted. */}
      <script dangerouslySetInnerHTML={{ __html: PENDING_SCRIPT }} />
      <ListContent
        {...props}
        requested={props.page ? withPage([], props.page, props.scope) : []}
        inlinePanel={false}
        preview
      />
    </div>
  );
}

async function ListContent({
  scope,
  basePath,
  title,
  sub,
  category,
  emptyTitle,
  requested,
  inlinePanel,
  preview,
}: Omit<ListResultsProps, "searchParams"> & {
  requested: ListFilters;
  inlinePanel: boolean;
  preview: boolean;
}) {
  const [list, facetsResult] = await Promise.all([
    getProductList(scope, requested),
    getFacets(scope, requested),
  ]);

  if (list.status !== "ok") {
    return (
      <>
        {title ? (
          <div className="lm-list-head">
            <h1>{title}</h1>
          </div>
        ) : null}
        <EmptyState
          icon={<BagIcon />}
          title={t("list.unavailable")}
          text={t("list.unavailableText")}
          action={
            <Link
              href={hrefWith(basePath, requested) as Route}
              className="lm-btn ghost"
              prefetch={false}
            >
              {t("list.retry")}
            </Link>
          }
        />
      </>
    );
  }

  const { page, filters, ignored } = list.data;
  const facets = facetsResult.status === "ok" ? facetsResult.data.facets : null;
  const active = activeFilters(filters);
  const chips = filterChips(filters, facets);
  const clearHref = hrefWith(basePath, cleared(filters, scope)) as Route;
  const attr = primaryAttribute(category, facets?.attributes ?? []);
  const attrName = attr ? `attr.${attr.key}` : null;
  const attrValue = attrName ? value(filters, attrName) : null;
  const showMore =
    !!facets && (facets.attributes.length > 0 || facets.options.length > 0);
  const currentPath = hrefWith(basePath, filters);

  return (
    <>
      {title ? (
        <div className="lm-list-head">
          <h1>{title}</h1>
          <span className="lm-count">{pluralize(page.total, "products")}</span>
        </div>
      ) : null}
      {sub !== undefined ? <p className="lm-sub">{sub}</p> : null}

      {/* One row, as the prototype "types" chips: the primary attribute, then the
          child categories. */}
      {(attr && attrName) || (category && category.children.length > 0) ? (
        <div className="lm-chips">
          {attr && attrName ? (
            <nav className="contents" aria-label={attr.label}>
              <Link
                href={
                  hrefWith(
                    basePath,
                    setValue(filters, attrName, null, scope),
                  ) as Route
                }
                scroll={false}
                className={cn("lm-chip", !attrValue && "on")}
                aria-current={!attrValue ? "true" : undefined}
              >
                {t("list.all")}
              </Link>
              {attr.options.map((option) => (
                <Link
                  key={option}
                  href={
                    hrefWith(
                      basePath,
                      setValue(filters, attrName, option, scope),
                    ) as Route
                  }
                  scroll={false}
                  className={cn("lm-chip", attrValue === option && "on")}
                  aria-current={attrValue === option ? "true" : undefined}
                >
                  {option}
                </Link>
              ))}
            </nav>
          ) : null}
          {category && category.children.length > 0 ? (
            <nav className="contents" aria-label={t("list.subcategories")}>
              {category.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/c/${encodeURIComponent(child.slug)}` as Route}
                  className="lm-chip"
                >
                  {child.name}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      ) : null}

      <FilterControls
        key={serializeFilters(filters)}
        scope={scope}
        basePath={basePath}
        filters={filters}
        facets={facets}
        showBrandSelect={scope.kind !== "brand"}
        showMore={showMore}
        activeCount={active.length}
        moreHref={
          preview
            ? `#${NO_JS_FILTERS}`
            : `${currentPath}${currentPath.includes("?") ? "&" : "?"}filters=1`
        }
      />

      {inlinePanel && facets ? (
        <div className="lm-fpanel-inline">
          <FilterPanel
            basePath={basePath}
            filters={filters}
            facets={facets}
            showBrands={scope.kind !== "brand"}
            showOnSale={scope.kind !== "sale"}
            clearHref={clearHref}
            formId="lm-filter-inline"
          />
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className="lm-active-filters" aria-label={t("list.activeFilters")}>
          {chips.map((chip) => {
            const rest = filters.filter(
              (pair) =>
                pair[0] !== "page" &&
                !chip.remove.some(([n, v]) => n === pair[0] && v === pair[1]),
            );
            return (
              <Link
                key={chip.label}
                href={hrefWith(basePath, rest) as Route}
                scroll={false}
                className="lm-chip removable"
                aria-label={t("list.removeFilter", { label: chip.label })}
              >
                {chip.label}
                <XIcon />
              </Link>
            );
          })}
        </div>
      ) : null}

      {ignored.length > 0 ? (
        <p className="lm-notice" role="status">
          {t("list.invalidFilters")}
        </p>
      ) : null}

      <section
        id="lm-results"
        className="lm-results"
        aria-label={t("list.results")}
      >
        {page.items.length > 0 ? (
          <div className="lm-grid">
            {page.items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                currentPath={currentPath}
              />
            ))}
          </div>
        ) : active.length > 0 ? (
          <EmptyState
            icon={<SearchIcon />}
            title={t("list.emptyFiltered")}
            text={t("list.emptyFilteredText")}
            action={
              <Link href={clearHref} className="lm-btn ghost" scroll={false}>
                {t("list.clearFilters")}
              </Link>
            }
          />
        ) : scope.kind === "search" ? (
          <EmptyState
            icon={<SearchIcon />}
            title={t("search.emptyTitle")}
            text={t("search.emptyText")}
          />
        ) : (
          <EmptyState icon={<BagIcon />} title={emptyTitle} />
        )}
        <Pager
          basePath={basePath}
          filters={filters}
          scope={scope}
          total={page.total}
        />
      </section>

      {preview && showMore && facets ? (
        <noscript>
          <div id={NO_JS_FILTERS} className="lm-fpanel-inline">
            <FilterPanel
              basePath={basePath}
              filters={filters}
              facets={facets}
              showBrands={scope.kind !== "brand"}
              showOnSale={scope.kind !== "sale"}
              clearHref={clearHref}
              formId="lm-filter-nojs"
            />
          </div>
        </noscript>
      ) : null}
    </>
  );
}

/** Same boxes as the list head, selects and a few cards while the list loads. */
export function ListSkeleton({ title }: { title: string | null }) {
  return (
    <div aria-busy="true" aria-label={t("common.loading")}>
      {title ? (
        <div className="lm-list-head">
          <h1>{title}</h1>
        </div>
      ) : null}
      <div className="lm-selects">
        {[0, 1, 2].map((i) => (
          <span key={i} className="lm-sel">
            <span className="lm-skel" style={{ width: 50, height: 12 }} />
            <span
              className="lm-skel"
              style={{ width: 130, height: 40, borderRadius: 10 }}
            />
          </span>
        ))}
      </div>
      <div className="lm-grid">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="lm-card">
            <span className="lm-art lm-skel" />
          </div>
        ))}
      </div>
    </div>
  );
}
