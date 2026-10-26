import { NextResponse, type NextRequest } from "next/server";

import {
  catalogRoute,
  createExistenceChecker,
} from "@/features/catalog/existence";
import { env } from "@/lib/env";

/**
 * Next.js 16 Proxy (the successor of middleware.ts).
 *
 * Catalog document requests (see `catalogRoute` in existence.ts):
 * - `/p/*`, `/c/*`, `/brands/*` with an unknown slug, and list pages `…/page/[n]` past the
 *   end, are rewritten to the not-found page with a real 404 status (checked against the
 *   backend: 1.5 s timeout, cached per process). Backend down or slow: passed through,
 *   and the page shows its usual state (200, noindex on not-found).
 * - the old `?page=N` list URLs and `…/page/1` redirect (308) to the path form.
 * Prefetches and client-side navigations (RSC requests) are not matched: there the
 * page's own `notFound()` shows the not-found UI and no status is visible.
 *
 * TODO(auth): /account and /checkout: optimistic check only. If neither session cookie
 * (see src/lib/auth/session.ts) is present, redirect to /login?next=<path>. Never call
 * the backend or verify tokens there; the real check happens where the data is read.
 */
const existence = createExistenceChecker({ apiBaseUrl: env.API_BASE_URL });

/** Matches no route, so Next.js renders the not-found page with status 404. */
const NOT_FOUND_PATH = "/_lamsa/not-found";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (request.method !== "GET" && request.method !== "HEAD")
    return NextResponse.next();
  const route = catalogRoute(
    request.nextUrl.pathname,
    request.nextUrl.searchParams,
  );
  if (!route) return NextResponse.next();
  if (route.action === "redirect")
    return NextResponse.redirect(new URL(route.location, request.url), 308);
  if (
    route.action === "check" &&
    (await existence.check(route.check)) !== "missing"
  )
    return NextResponse.next();
  return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url), {
    status: 404,
  });
}

// Document requests only (no RSC payload, router prefetch or browser prefetch). The
// matcher must be literal (statically analyzed), hence the repetition.
export const config = {
  matcher: [
    "/account/:path*",
    "/checkout/:path*",
    {
      source: "/p/:slug",
      missing: [
        { type: "header", key: "rsc" },
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
        { type: "header", key: "sec-purpose", value: "prefetch.*" },
      ],
    },
    {
      source: "/c/:slug",
      missing: [
        { type: "header", key: "rsc" },
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
        { type: "header", key: "sec-purpose", value: "prefetch.*" },
      ],
    },
    {
      source: "/brands/:slug",
      missing: [
        { type: "header", key: "rsc" },
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
        { type: "header", key: "sec-purpose", value: "prefetch.*" },
      ],
    },
    {
      source: "/c/:slug/page/:n",
      missing: [
        { type: "header", key: "rsc" },
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
        { type: "header", key: "sec-purpose", value: "prefetch.*" },
      ],
    },
    {
      source: "/brands/:slug/page/:n",
      missing: [
        { type: "header", key: "rsc" },
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
        { type: "header", key: "sec-purpose", value: "prefetch.*" },
      ],
    },
    {
      source: "/new/page/:n",
      missing: [
        { type: "header", key: "rsc" },
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
        { type: "header", key: "sec-purpose", value: "prefetch.*" },
      ],
    },
    {
      source: "/sale/page/:n",
      missing: [
        { type: "header", key: "rsc" },
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
        { type: "header", key: "sec-purpose", value: "prefetch.*" },
      ],
    },
    {
      source: "/new",
      has: [{ type: "query", key: "page" }],
      missing: [
        { type: "header", key: "rsc" },
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
        { type: "header", key: "sec-purpose", value: "prefetch.*" },
      ],
    },
    {
      source: "/sale",
      has: [{ type: "query", key: "page" }],
      missing: [
        { type: "header", key: "rsc" },
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
        { type: "header", key: "sec-purpose", value: "prefetch.*" },
      ],
    },
  ],
};
