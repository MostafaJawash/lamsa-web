/**
 * List filters as URL state, with the backend's own parameter names (`brand`,
 * `min_price`, `attr.<key>`, `opt.<key>`, `sort`, `page`, …). Pure functions shared by
 * the server render, the links and the client controls.
 *
 * The state is a normalized list of [name, value] pairs: names validated, values trimmed,
 * duplicates removed, sorted. `serializeFilters()` of the same filters always gives the
 * same string, so it is also the cache key of the backend request.
 */

export type ListScope =
  | { kind: "category"; slug: string }
  | { kind: "brand"; slug: string }
  | { kind: "new" }
  | { kind: "sale" }
  | { kind: "search" };

export type FilterPair = readonly [name: string, value: string];
export type ListFilters = readonly FilterPair[];

export const PAGE_SIZE = 24;

export const SORTS = [
  "newest",
  "price_asc",
  "price_desc",
  "relevance",
] as const;
export type SortKey = (typeof SORTS)[number];

const MONEY = /^\d{1,6}(\.\d{1,2})?$/;
const NUMBER = /^-?\d{1,9}(\.\d{1,4})?$/;
const KEY = /^[a-z][a-z0-9_]{0,63}$/;
const MAX_VALUE_LENGTH = 100;

/** Price select presets (prototype: `now >= lo && now < hi`; backend bounds are inclusive). */
export const PRICE_PRESETS = {
  lt5: { min: null, max: "4.99" },
  "5to15": { min: "5", max: "14.99" },
  gt15: { min: "15", max: null },
} as const;
export type PricePreset = keyof typeof PRICE_PRESETS;

/** Names that never come from the URL for a scope (the page fixes them). */
function fixedNames(scope: ListScope): Set<string> {
  if (scope.kind === "brand") return new Set(["brand"]);
  if (scope.kind === "sale") return new Set(["on_sale"]);
  if (scope.kind === "new") return new Set(["is_new"]);
  return new Set();
}

/** Whether a [name, value] pair is a valid filter for the scope (before normalization). */
function validPair(name: string, value: string, scope: ListScope): boolean {
  if (!value || value.length > MAX_VALUE_LENGTH) return false;
  if (fixedNames(scope).has(name)) return false;
  switch (name) {
    case "brand":
      return true;
    case "min_price":
    case "max_price":
      return MONEY.test(value);
    case "in_stock":
    case "on_sale":
      return value === "true";
    case "sort":
      return (
        (SORTS as readonly string[]).includes(value) &&
        (value !== "relevance" || scope.kind === "search")
      );
    case "page":
      return /^[1-9]\d{0,3}$/.test(value);
    case "q":
      return scope.kind === "search";
    default: {
      const attr = /^attr\.([a-z0-9_]+)(\.(min|max))?$/.exec(name);
      if (attr)
        return KEY.test(attr[1] ?? "") && (attr[2] ? NUMBER.test(value) : true);
      const opt = /^opt\.([a-z0-9_]+)$/.exec(name);
      return opt ? KEY.test(opt[1] ?? "") : false;
    }
  }
}

/** Names that hold one value (the last one wins). */
function singleValued(name: string): boolean {
  return (
    [
      "min_price",
      "max_price",
      "in_stock",
      "on_sale",
      "sort",
      "page",
      "q",
    ].includes(name) || /^attr\.[a-z0-9_]+\.(min|max)$/.test(name)
  );
}

function normalize(
  pairs: Iterable<readonly [string, string]>,
  scope: ListScope,
): ListFilters {
  const single = new Map<string, string>();
  const multi = new Set<string>();
  for (const [rawName, rawValue] of pairs) {
    const name = rawName.trim();
    const value = rawValue.trim().replace(/\s+/g, " ");
    if (!validPair(name, value, scope)) continue;
    if (singleValued(name)) single.set(name, value);
    else multi.add(`${name}\u0000${value}`);
  }
  const out: FilterPair[] = [
    ...[...single.entries()],
    ...[...multi].map((entry) => {
      const [name = "", value = ""] = entry.split("\u0000");
      return [name, value] as const;
    }),
  ];
  // page=1 is the default.
  const filtered = out.filter(
    ([name, value]) => !(name === "page" && value === "1"),
  );
  filtered.sort((a, b) => (a[0] === b[0] ? cmp(a[1], b[1]) : cmp(a[0], b[0])));
  return filtered;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Reads filters from URL search params (Next.js `searchParams` object or URLSearchParams).
 * Accepts the no-JS price select (`price=lt5`) and maps it to min/max.
 */
export function parseFilters(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
  scope: ListScope,
): ListFilters {
  const pairs: [string, string][] = [];
  const add = (name: string, value: string) => pairs.push([name, value]);
  const entries: [string, string][] =
    input instanceof URLSearchParams
      ? [...input.entries()]
      : Object.entries(input).flatMap(([name, value]) =>
          value === undefined
            ? []
            : (Array.isArray(value) ? value : [value]).map(
                (v) => [name, v] as [string, string],
              ),
        );
  let preset: PricePreset | null = null;
  for (const [name, value] of entries) {
    if (name === "price") {
      if (value in PRICE_PRESETS) preset = value as PricePreset;
      continue;
    }
    add(name, value);
  }
  if (preset) {
    const range = PRICE_PRESETS[preset];
    const rest = pairs.filter(([n]) => n !== "min_price" && n !== "max_price");
    pairs.length = 0;
    pairs.push(...rest);
    if (range.min) add("min_price", range.min);
    if (range.max) add("max_price", range.max);
  }
  return normalize(pairs, scope);
}

/** `a=b&c=d`, normalized; "" when empty. */
export function serializeFilters(filters: ListFilters): string {
  return filters
    .map(
      ([name, value]) =>
        `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

/** Search keeps the page in the query (it is noindex); every other list has it in the path. */
export const SEARCH_PATH = "/search";

/**
 * The path of page `page` of a list: "/c/care" for page 1, "/c/care/page/2" after. The page
 * is part of the path so list metadata needs no search params (it stays in the static
 * <head>) and every page has its own canonical URL.
 */
export function pagedPath(basePath: string, page: number): string {
  return page > 1 && basePath !== SEARCH_PATH
    ? `${basePath}/page/${page}`
    : basePath;
}

/**
 * A page URL with these filters, e.g. hrefWith("/c/care", filters) → "/c/care?brand=x";
 * with page 2 → "/c/care/page/2?brand=x" (search: "/search?page=2&q=…").
 */
export function hrefWith(basePath: string, filters: ListFilters): string {
  const inPath = basePath !== SEARCH_PATH;
  const query = serializeFilters(
    inPath ? filters.filter(([n]) => n !== "page") : filters,
  );
  const path = inPath ? pagedPath(basePath, currentPage(filters)) : basePath;
  return query ? `${path}?${query}` : path;
}

export function values(filters: ListFilters, name: string): string[] {
  return filters.filter(([n]) => n === name).map(([, v]) => v);
}

export function value(filters: ListFilters, name: string): string | null {
  return filters.find(([n]) => n === name)?.[1] ?? null;
}

export function has(filters: ListFilters, name: string, val: string): boolean {
  return filters.some(([n, v]) => n === name && v === val);
}

/** Any change of the result set goes back to page 1. */
function withoutPage(filters: ListFilters): FilterPair[] {
  return filters.filter(([n]) => n !== "page");
}

/** Adds or removes one value of a multi-valued filter (brand, attr.x, opt.x). */
export function toggle(
  filters: ListFilters,
  name: string,
  val: string,
  scope: ListScope,
): ListFilters {
  const rest = withoutPage(filters);
  const next = has(rest, name, val)
    ? rest.filter(([n, v]) => !(n === name && v === val))
    : [...rest, [name, val] as const];
  return normalize(next, scope);
}

/** Replaces every value of `name` (null removes it). */
export function setValue(
  filters: ListFilters,
  name: string,
  val: string | null,
  scope: ListScope,
): ListFilters {
  const rest = withoutPage(filters).filter(([n]) => n !== name);
  return normalize(
    val === null ? rest : [...rest, [name, val] as const],
    scope,
  );
}

/** Removes one exact pair. */
export function without(
  filters: ListFilters,
  name: string,
  val: string,
  scope: ListScope,
): ListFilters {
  return normalize(
    withoutPage(filters).filter(([n, v]) => !(n === name && v === val)),
    scope,
  );
}

/** Keeps only the search text and sort ("مسح الكل"). */
export function cleared(filters: ListFilters, scope: ListScope): ListFilters {
  return normalize(
    filters.filter(([n]) => n === "q" || n === "sort"),
    scope,
  );
}

export function withPage(
  filters: ListFilters,
  page: number,
  scope: ListScope,
): ListFilters {
  const rest = filters.filter(([n]) => n !== "page");
  return normalize(
    page > 1 ? [...rest, ["page", String(page)] as const] : rest,
    scope,
  );
}

export function currentPage(filters: ListFilters): number {
  return Number(value(filters, "page") ?? "1");
}

/** Filters that narrow the result set (not q, sort or page): the "active" count. */
export function activeFilters(filters: ListFilters): ListFilters {
  return filters.filter(([n]) => n !== "q" && n !== "sort" && n !== "page");
}

/** The price preset matching min/max exactly; "custom" for other ranges; null for none. */
export function pricePreset(
  filters: ListFilters,
): PricePreset | "custom" | null {
  const min = value(filters, "min_price");
  const max = value(filters, "max_price");
  if (!min && !max) return null;
  for (const [key, range] of Object.entries(PRICE_PRESETS) as [
    PricePreset,
    (typeof PRICE_PRESETS)[PricePreset],
  ][]) {
    if (range.min === min && range.max === max) return key;
  }
  return "custom";
}

/** Sets min/max for a preset (null clears the price filter). */
export function withPricePreset(
  filters: ListFilters,
  preset: PricePreset | null,
  scope: ListScope,
): ListFilters {
  const rest = withoutPage(filters).filter(
    ([n]) => n !== "min_price" && n !== "max_price",
  );
  const range = preset ? PRICE_PRESETS[preset] : null;
  const next: FilterPair[] = [...rest];
  if (range?.min) next.push(["min_price", range.min]);
  if (range?.max) next.push(["max_price", range.max]);
  return normalize(next, scope);
}

/** Default sort: relevance when searching, otherwise newest (backend defaults). */
export function effectiveSort(filters: ListFilters): SortKey {
  const sort = value(filters, "sort");
  if (sort && (SORTS as readonly string[]).includes(sort))
    return sort as SortKey;
  return value(filters, "q") ? "relevance" : "newest";
}

/** The backend query for a list: the scope's fixed params, the filters, page size. */
export function backendQuery(
  scope: ListScope,
  filters: ListFilters,
  forFacets = false,
): string {
  const pairs: [string, string][] = [];
  if (scope.kind === "category") pairs.push(["category", scope.slug]);
  if (scope.kind === "brand") pairs.push(["brand", scope.slug]);
  if (scope.kind === "new") pairs.push(["is_new", "true"]);
  if (scope.kind === "sale") pairs.push(["on_sale", "true"]);
  for (const [name, val] of filters) {
    if (forFacets && (name === "sort" || name === "page")) continue;
    pairs.push([name, val]);
  }
  if (!forFacets) pairs.push(["page_size", String(PAGE_SIZE)]);
  pairs.sort((a, b) => (a[0] === b[0] ? cmp(a[1], b[1]) : cmp(a[0], b[0])));
  return pairs
    .map(([n, v]) => `${encodeURIComponent(n)}=${encodeURIComponent(v)}`)
    .join("&");
}

/** Removes every pair with this name (used when the backend rejects a parameter). */
export function dropParam(filters: ListFilters, name: string): ListFilters {
  return filters.filter(([n]) => n !== name && !n.startsWith(`${name}.`));
}

/**
 * The page number of a `/page/[n]` segment: 2..9999 without leading zeros, else null
 * (page 1 lives at the list's own path).
 */
export function pageFromSegment(raw: string): number | null {
  return /^[1-9]\d{0,3}$/.test(raw) && raw !== "1" ? Number(raw) : null;
}

/** Pages 2..last of a list of `total` products, at most `max` (static params). */
export function laterPages(total: number, max = 10): number[] {
  const last = Math.min(Math.ceil(total / PAGE_SIZE), max + 1);
  return Array.from({ length: Math.max(0, last - 1) }, (_, i) => i + 2);
}
