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
 * Call inside a `"use cache"` function. Success gets `lifetime`; a failure gets the
 * short `"seconds"` profile, which Next.js keeps out of prerenders (it becomes a
 * request-time hole instead of failing the build or baking a fallback into the static
 * page) and retries about once a second at runtime.
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
    cacheLife("seconds");
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
