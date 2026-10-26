/**
 * Catalog URL handling for the Proxy, so document requests get real statuses:
 * - unknown product, category and brand slugs, and list pages past the end, get a 404
 *   (pages stream their static shell before `notFound()` can run, so the status would
 *   otherwise stay 200 with noindex);
 * - the old `?page=N` list URLs and `/page/1` redirect (308) to the path form.
 *
 * Pure apart from the injected `fetch` and clock, so it is unit-tested directly.
 */
import { PAGE_SIZE, pageFromSegment } from "./filters";

/** "exists" and "missing" are cached; "unknown" (backend down, timeout, 5xx) is not. */
export type Existence = "exists" | "missing" | "unknown";

/** A backend read whose answer decides whether the page exists. */
export type ExistenceCheck = {
  /** Cache key. */
  key: string;
  /** Path under the API base URL. */
  path: string;
  /** List page: exists when the backend returns items (else: when it answers 200). */
  list: boolean;
};

export type CatalogRoute =
  | { action: "redirect"; location: string }
  | { action: "not-found" }
  | { action: "check"; check: ExistenceCheck };

export const EXISTS_TTL_MS = 5 * 60_000;
export const MISSING_TTL_MS = 60_000;
export const MAX_ENTRIES = 5_000;
export const CHECK_TIMEOUT_MS = 1_500;

type Entry = { value: "exists" | "missing"; expires: number };

export type ExistenceChecker = {
  check(check: ExistenceCheck): Promise<Existence>;
  /** Number of cached entries (tests). */
  size(): number;
};

export function createExistenceChecker({
  apiBaseUrl,
  fetcher = fetch,
  now = Date.now,
  maxEntries = MAX_ENTRIES,
  timeoutMs = CHECK_TIMEOUT_MS,
}: {
  apiBaseUrl: string;
  fetcher?: typeof fetch;
  now?: () => number;
  maxEntries?: number;
  timeoutMs?: number;
}): ExistenceChecker {
  // A Map keeps insertion order: re-inserting on a hit makes the first key the least
  // recently used one (LRU).
  const cache = new Map<string, Entry>();

  function remember(key: string, value: Entry["value"]) {
    cache.delete(key);
    cache.set(key, {
      value,
      expires: now() + (value === "exists" ? EXISTS_TTL_MS : MISSING_TTL_MS),
    });
    while (cache.size > maxEntries) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  async function read(check: ExistenceCheck): Promise<Existence> {
    try {
      const response = await fetcher(`${apiBaseUrl}${check.path}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 404) {
        await response.body?.cancel();
        return "missing";
      }
      if (!response.ok) {
        await response.body?.cancel();
        return "unknown";
      }
      if (!check.list) {
        // The body is not needed; release the connection.
        await response.body?.cancel();
        return "exists";
      }
      const page = (await response.json()) as { items?: unknown[] };
      if (!Array.isArray(page.items)) return "unknown";
      return page.items.length > 0 ? "exists" : "missing";
    } catch {
      return "unknown";
    }
  }

  async function check(target: ExistenceCheck): Promise<Existence> {
    const hit = cache.get(target.key);
    if (hit && hit.expires > now()) {
      cache.delete(target.key);
      cache.set(target.key, hit);
      return hit.value;
    }
    if (hit) cache.delete(target.key);
    const value = await read(target);
    if (value !== "unknown") remember(target.key, value);
    return value;
  }

  return { check, size: () => cache.size };
}

const DETAIL = { p: "products", c: "categories", brands: "brands" } as const;

/** The backend list query of a list base path (`/c/x`, `/brands/x`, `/new`, `/sale`). */
function listQuery(section: string, slug: string | undefined): string | null {
  if (section === "c" && slug) return `category=${encodeURIComponent(slug)}`;
  if (section === "brands" && slug) return `brand=${encodeURIComponent(slug)}`;
  if (section === "new") return "is_new=true";
  if (section === "sale") return "on_sale=true";
  return null;
}

function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** `?rest` without `page` ("" when nothing is left). */
function queryWithout(search: URLSearchParams, name: string): string {
  const rest = new URLSearchParams(search);
  rest.delete(name);
  const text = rest.toString();
  return text ? `?${text}` : "";
}

/**
 * What the Proxy does for a catalog URL: redirect, 404, a backend existence check, or
 * nothing (null).
 */
export function catalogRoute(
  pathname: string,
  search: URLSearchParams,
): CatalogRoute | null {
  const match =
    /^\/(?:(p|c|brands)\/([^/]+)|(new|sale))(?:\/page\/([^/]+))?\/?$/.exec(
      pathname,
    );
  if (!match) return null;
  const section = match[1] ?? match[3] ?? "";
  const rawSlug = match[2];
  const rawPage = match[4];
  const base = rawSlug ? `/${section}/${rawSlug}` : `/${section}`;
  const slug = rawSlug === undefined ? undefined : decode(rawSlug);
  if (slug === null) return null;

  if (section === "p") {
    if (rawPage !== undefined) return { action: "not-found" };
    return {
      action: "check",
      check: {
        key: `product:${slug}`,
        path: `/${DETAIL.p}/${encodeURIComponent(slug ?? "")}`,
        list: false,
      },
    };
  }

  const query = listQuery(section, slug);
  if (!query) return null;

  if (rawPage !== undefined) {
    if (rawPage === "1")
      return {
        action: "redirect",
        location: `${base}${queryWithout(search, "page")}`,
      };
    const page = pageFromSegment(rawPage);
    if (!page) return { action: "not-found" };
    if (search.has("page"))
      return {
        action: "redirect",
        location: `${base}/page/${page}${queryWithout(search, "page")}`,
      };
    return {
      action: "check",
      check: {
        key: `${query}&page=${page}`,
        path: `/products?${query}&page=${page}&page_size=${PAGE_SIZE}`,
        list: true,
      },
    };
  }

  const oldPage = search.get("page");
  if (oldPage !== null) {
    const page = pageFromSegment(oldPage);
    const path = page ? `${base}/page/${page}` : base;
    return {
      action: "redirect",
      location: `${path}${queryWithout(search, "page")}`,
    };
  }

  if (section === "new" || section === "sale") return null;
  const kind = section === "c" ? "category" : "brand";
  return {
    action: "check",
    check: {
      key: `${kind}:${slug}`,
      path: `/${DETAIL[section === "c" ? "c" : "brands"]}/${encodeURIComponent(slug ?? "")}`,
      list: false,
    },
  };
}
