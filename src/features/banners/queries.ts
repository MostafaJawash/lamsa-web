/**
 * banners: server-side reads.
 * Backend: GET /banners
 *
 * Belongs here: async functions that read through `publicApi` (anonymous, cacheable
 * with "use cache") or `getApi()` (sends the visitor's token; render inside <Suspense>)
 * from "@/lib/api/client", unwrap the result and return the types from ./types.
 * Server-only: never import this file from a client component.
 */
import "server-only";

import { cacheTag } from "next/cache";

import { pageTimeout, publicApi, unwrap } from "@/lib/api/client";
import {
  safeQuery,
  settle,
  type Loaded,
  type QueryResult,
} from "@/lib/api/result";

import type { Banner } from "./types";

/** Backend cache: 60 s (README "What is cached"). */
async function loadBanners(): Promise<Loaded<Banner[]>> {
  "use cache";
  cacheTag("banners");
  return settle({ stale: 60, revalidate: 60, expire: 600 }, () =>
    unwrap(publicApi.GET("/banners", { signal: pageTimeout() })),
  );
}

/** Active banners in the admin's order (at most 10). */
export function getBanners(): Promise<QueryResult<Banner[]>> {
  return safeQuery("banners", loadBanners, (banners) => banners.length === 0);
}
