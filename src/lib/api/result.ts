import "server-only";

import { cacheLife } from "next/cache";

/**
 * Result of a page-level backend read. Queries never throw to the page: sections render
 * real data, an empty state, or a fallback when the backend is unavailable.
 */
export type QueryResult<T> =
  { status: "ok"; data: T } | { status: "empty" } | { status: "unavailable" };

/** Serializable outcome of a cached load (a `"use cache"` function must not throw). */
export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

/** Seconds, as in `cacheLife({ stale, revalidate, expire })`. */
export type CacheLifetime = {
  stale: number;
  revalidate: number;
  expire: number;
};

function describe(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

/**
 * Failures during `next build` and `next dev`: long enough to be part of a prerender
 * (stale of 30 s or more, expire of 5 minutes or more), so a build without a reachable
 * backend bakes the fallback into the static page instead of failing on data outside
 * <Suspense> (catalog pages read their data in the page itself, so their static shell
 * works without JavaScript), and dev, which checks every request like a prerender, does
 * not report it either. The page regenerates after 30 seconds.
 */
const PRERENDER_FAILURE_LIFE: CacheLifetime = {
  stale: 30,
  revalidate: 30,
  expire: 300,
};

/**
 * Call inside a `"use cache"` function. Success gets `lifetime`; at runtime a failure gets
 * the short `"seconds"` profile, which Next.js keeps out of prerenders (it becomes a
 * request-time hole instead of baking a fallback into the static page) and retries about
 * once a second. During `next build` and `next dev`, see `PRERENDER_FAILURE_LIFE`.
 *
 * Throwing inside `"use cache"` is not an option: Next.js treats it as a prerender error.
 */
export async function settle<T>(
  lifetime: CacheLifetime,
  load: () => Promise<T>,
): Promise<Loaded<T>> {
  try {
    const data = await load();
    cacheLife(lifetime);
    return { ok: true, data };
  } catch (error) {
    if (
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.NODE_ENV === "development"
    )
      cacheLife(PRERENDER_FAILURE_LIFE);
    else cacheLife("seconds");
    return { ok: false, error: describe(error) };
  }
}

const LOG_INTERVAL_MS = 60_000;
const lastLogged = new Map<string, number>();

/**
 * Logs a failed read at most once a minute per kind, so a down backend doesn't flood the
 * log. Uses the monotonic `performance.now()`: `Date.now()` is not allowed while Next.js
 * prerenders.
 */
export function logQueryFailure(
  kind: string,
  error: string,
  now = performance.now(),
): void {
  const last = lastLogged.get(kind);
  if (last !== undefined && now - last < LOG_INTERVAL_MS) return;
  lastLogged.set(kind, now);
  console.error(`[lamsa] ${kind} unavailable: ${error}`);
}

/** Turns a cached `Loaded<T>` into the `QueryResult` that sections render from. */
export async function safeQuery<T>(
  kind: string,
  load: () => Promise<Loaded<T>>,
  isEmpty: (data: T) => boolean,
): Promise<QueryResult<T>> {
  let loaded: Loaded<T>;
  try {
    loaded = await load();
  } catch (error) {
    // Defensive: `settle()` already catches backend failures.
    loaded = { ok: false, error: describe(error) };
  }
  if (!loaded.ok) {
    logQueryFailure(kind, loaded.error);
    return { status: "unavailable" };
  }
  return isEmpty(loaded.data)
    ? { status: "empty" }
    : { status: "ok", data: loaded.data };
}

/** Result of a single-item read: `not_found` (backend 404) renders the 404 page. */
export type DetailResult<T> =
  | { status: "ok"; data: T }
  | { status: "not_found" }
  | { status: "unavailable" };

/** Like `safeQuery` for one item: the loader returns `null` for a backend 404. */
export async function safeDetail<T>(
  kind: string,
  load: () => Promise<Loaded<T | null>>,
): Promise<DetailResult<T>> {
  let loaded: Loaded<T | null>;
  try {
    loaded = await load();
  } catch (error) {
    loaded = { ok: false, error: describe(error) };
  }
  if (!loaded.ok) {
    logQueryFailure(kind, loaded.error);
    return { status: "unavailable" };
  }
  return loaded.data === null
    ? { status: "not_found" }
    : { status: "ok", data: loaded.data };
}
