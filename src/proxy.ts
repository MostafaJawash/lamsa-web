import type { Route } from "next";
import { NextResponse, type NextRequest } from "next/server";

import {
  encodeFlash,
  FLASH_COOKIE,
  FLASH_HEADER,
  flashToast,
} from "@/features/cart/flash";
import { decodeCart, decodeFavorites } from "@/features/cart/guest-codec";
import {
  clearedGuestCookieSpecs,
  flashCookieOptions,
  GUEST_CART_COOKIE,
  GUEST_FAVORITES_COOKIE,
  guestCookieOptions,
  logMalformed,
  MERGE_RETRY_COOKIE,
} from "@/features/cart/guest-store";
import { mergeGuestData } from "@/features/cart/merge";
import {
  catalogRoute,
  createExistenceChecker,
} from "@/features/catalog/existence";
import { addressRoute } from "@/features/account/routes";
import { orderRoute } from "@/features/orders/routes";
import { createApiClient } from "@/lib/api/client";
import { needsRefresh } from "@/lib/auth/jwt";
import { safeNext, withNext } from "@/lib/auth/next-param";
import {
  CHANGE_PASSWORD_PATH,
  COMPLETE_PROFILE_PATH,
  isGuestOnlyPath,
  isPasswordChangePath,
  isProtectedPath,
  LOGIN_PATH,
} from "@/lib/auth/paths";
import { refresher } from "@/lib/auth/refresh";
import {
  ACCESS_TOKEN_COOKIE,
  clearedSessionCookieSpecs,
  PASSWORD_CHANGE_COOKIE,
  REFRESH_TOKEN_COOKIE,
  sessionCookieSpecs,
  SIGNUP_COOKIE,
  type CookieSpec,
} from "@/lib/auth/session";
import { env } from "@/lib/env";
import {
  clientContextFrom,
  proxyRequestId,
  REQUEST_ID_HEADER,
  type ClientContext,
} from "@/lib/http/client-context";

/**
 * Next.js 16 Proxy (the successor of middleware.ts). Runs for pages and RSC requests,
 * never for static files, images or prefetches (see `config.matcher`).
 *
 * 1. Stamps X-Request-ID on the forwarded request (passed on to the backend).
 * 2. Session (GET/HEAD): when the access cookie is missing or expires within 60 s and
 *    a refresh cookie exists, POST /auth/refresh (single-flight per refresh token, see
 *    src/lib/auth/refresh.ts), set both new cookies on the response AND on the
 *    forwarded request, so server components see the new token in this same request.
 *    Rejected (TOKEN_REUSED / TOKEN_INVALID / TOKEN_EXPIRED): clear the cookies and
 *    continue as a guest. Backend down: continue as is.
 * 3. Gates (optimistic, from the cookies; pages re-check with requireUser()):
 *    - /account/*, /checkout/* without a session → /login?next=<path>;
 *    - temporary password (`lamsa_pwc`) → /account/change-password?next=<path>;
 *    - /login, /register with a valid session (GET /users/me) → next or "/";
 *    - /complete-profile without the Google signup cookie → /login.
 * 4. Guest cart and favorites cookies (see src/features/cart): a malformed one is
 *    reset; after a failed merge at login (marker cookie), the merge is retried once
 *    here with the session; the flash cookie of a redirect (a toast) is handed to the
 *    page of a document request through a header and expired (shown once, also
 *    without JavaScript; with JavaScript the client controller reads it itself).
 * 5. Catalog document requests (see `catalogRoute` in existence.ts): unknown slugs and
 *    list pages past the end get a real 404 (checked against the backend: 1.5 s
 *    timeout, cached per process; backend down → passed through), and the old
 *    `?page=N` URLs and `…/page/1` redirect (308). Only for documents
 *    (`Sec-Fetch-Dest: document`, or no such header: curl, bots); client navigations
 *    (RSC) are not checked, there the page's own `notFound()` shows the not-found UI.
 *    Next.js strips the RSC headers from `request` here, hence Sec-Fetch-Dest.
 * 6. An order's own pages (`/account/orders/<id>`, `/checkout/success/<id>`), documents
 *    only: an id that is not the signed-in customer's order (someone else's, missing, or
 *    not a number) gets a real 404 (`GET /orders/{id}` with their token: 1.5 s, not
 *    cached; backend down → passed through). The answer is the same for "not yours" and
 *    "does not exist", so nothing leaks. The same for `/account/addresses?edit=<id>` and
 *    `?delete=<id>` with an address that is not theirs.
 */
const existence = createExistenceChecker({ apiBaseUrl: env.API_BASE_URL });

/** Matches no route, so Next.js renders the not-found page with status 404. */
const NOT_FOUND_PATH = "/_lamsa/not-found";

const VERIFY_TIMEOUT_MS = 1_500;

const CATALOG_CHECK_HEADER = "x-lamsa-catalog-check";
const ORDER_CHECK_HEADER = "x-lamsa-order-check";

type SessionView = {
  accessToken: string | null;
  /** A refresh cookie survives (possibly unverified when the backend is down). */
  hasRefresh: boolean;
  mustChangePassword: boolean;
};

/** Cookie changes for the response, mirrored on the forwarded request. */
class CookieChanges {
  readonly specs: CookieSpec[] = [];
  /** The flash cookie (not httpOnly): a new value, or "" to expire it. */
  flash: string | null = null;

  constructor(private readonly request: NextRequest) {}

  apply(specs: CookieSpec[]) {
    for (const spec of specs) {
      this.specs.push(spec);
      if (spec.options.maxAge > 0)
        this.request.cookies.set(spec.name, spec.value);
      else this.request.cookies.delete(spec.name);
    }
  }

  writeTo(response: NextResponse): NextResponse {
    for (const spec of this.specs)
      response.cookies.set(spec.name, spec.value, spec.options);
    if (this.flash !== null)
      response.cookies.set(
        FLASH_COOKIE,
        this.flash,
        flashCookieOptions(this.flash ? undefined : 0),
      );
    return response;
  }
}

async function syncSession(
  request: NextRequest,
  client: ClientContext,
  changes: CookieChanges,
): Promise<SessionView> {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value || null;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value || null;
  const mustChangePassword =
    request.cookies.get(PASSWORD_CHANGE_COOKIE)?.value === "1";
  const current = {
    accessToken,
    hasRefresh: !!refreshToken,
    mustChangePassword,
  };
  if (!refreshToken || !needsRefresh(accessToken)) return current;

  const outcome = await refresher.refresh(refreshToken, client);
  if (outcome.kind === "refreshed") {
    changes.apply(sessionCookieSpecs(outcome.pair));
    return {
      accessToken: outcome.pair.access_token,
      hasRefresh: true,
      mustChangePassword: outcome.pair.user.must_change_password,
    };
  }
  if (outcome.kind === "rejected") {
    changes.apply(clearedSessionCookieSpecs());
    return { accessToken: null, hasRefresh: false, mustChangePassword: false };
  }
  return current;
}

/** Is this access token still accepted? ("unknown": backend down or slow). */
async function verifyAccess(
  accessToken: string,
  client: ClientContext,
): Promise<"valid" | "invalid" | "unknown"> {
  try {
    const { response } = await createApiClient({ accessToken, client }).GET(
      "/users/me",
      { signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS) },
    );
    if (response.ok) return "valid";
    return response.status === 401 || response.status === 403
      ? "invalid"
      : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Guest cookies: reset a malformed one; retry a failed login merge once (marker
 * cookie); returns a flash to show on this page (a merge retry's result).
 */
async function syncGuestData(
  request: NextRequest,
  session: SessionView,
  client: ClientContext,
  changes: CookieChanges,
): Promise<string | null> {
  const cart = decodeCart(request.cookies.get(GUEST_CART_COOKIE)?.value);
  const favorites = decodeFavorites(
    request.cookies.get(GUEST_FAVORITES_COOKIE)?.value,
  );
  for (const [kind, name, decoded] of [
    ["cart", GUEST_CART_COOKIE, cart],
    ["favorites", GUEST_FAVORITES_COOKIE, favorites],
  ] as const) {
    if (!decoded.malformed) continue;
    logMalformed(kind);
    changes.apply([{ name, value: "", options: guestCookieOptions(0) }]);
  }
  if (
    !session.accessToken ||
    session.mustChangePassword ||
    !request.cookies.has(MERGE_RETRY_COOKIE)
  )
    return null;
  try {
    const flash = await mergeGuestData(
      createApiClient({ accessToken: session.accessToken, client }),
      cart.items,
      favorites.items,
    );
    changes.apply(clearedGuestCookieSpecs());
    return flashToast(flash) ? encodeFlash(flash) : null;
  } catch (error) {
    // Once: keep the guest cookies (nothing is lost), drop the marker.
    console.error(`[lamsa] guest merge retry failed: ${String(error)}`);
    changes.apply([
      { name: MERGE_RETRY_COOKIE, value: "", options: guestCookieOptions(0) },
    ]);
    return null;
  }
}

/** Is this the signed-in customer's order? ("unknown": backend down or slow). */
async function orderOwnership(
  id: number,
  accessToken: string,
  client: ClientContext,
): Promise<"found" | "missing" | "unknown"> {
  try {
    const { response } = await createApiClient({ accessToken, client }).GET(
      "/orders/{order_id}",
      {
        params: { path: { order_id: id } },
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      },
    );
    if (response.ok) return "found";
    return response.status === 404 ? "missing" : "unknown";
  } catch {
    return "unknown";
  }
}

/** Is this one of the signed-in customer's addresses? */
async function addressOwnership(
  id: number,
  accessToken: string,
  client: ClientContext,
): Promise<"found" | "missing" | "unknown"> {
  try {
    const { data, response } = await createApiClient({
      accessToken,
      client,
    }).GET("/users/me/addresses", {
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!response.ok || !data) return "unknown";
    return data.some((address) => address.id === id) ? "found" : "missing";
  } catch {
    return "unknown";
  }
}

function isDocumentRequest(request: NextRequest): boolean {
  const dest = request.headers.get("sec-fetch-dest");
  return dest === null || dest === "document";
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const trustProxy = env.WEB_TRUST_PROXY_HEADERS;
  const requestId = proxyRequestId(request.headers, trustProxy);
  const client = {
    ...clientContextFrom(request.headers, trustProxy),
    requestId,
  };
  const changes = new CookieChanges(request);
  let flash: string | null = null;

  const forward = (): { request: { headers: Headers } } => {
    const headers = new Headers(request.headers);
    headers.set(REQUEST_ID_HEADER, requestId);
    headers.delete(FLASH_HEADER);
    if (flash) headers.set(FLASH_HEADER, flash);
    return { request: { headers } };
  };
  const redirectTo = (location: string, status = 307) =>
    changes.writeTo(
      NextResponse.redirect(new URL(location, request.url), status),
    );

  if (request.method !== "GET" && request.method !== "HEAD")
    return NextResponse.next(forward());

  const { pathname, search, searchParams } = request.nextUrl;
  const here = `${pathname}${search}`;
  const session = await syncSession(request, client, changes);
  const hasSession = !!session.accessToken || session.hasRefresh;

  if (isProtectedPath(pathname) && !hasSession)
    return redirectTo(withNext(LOGIN_PATH, here));

  if (
    hasSession &&
    session.mustChangePassword &&
    !isPasswordChangePath(pathname)
  )
    return redirectTo(withNext(CHANGE_PASSWORD_PATH, here));

  if (pathname === COMPLETE_PROFILE_PATH && !request.cookies.has(SIGNUP_COOKIE))
    return redirectTo(LOGIN_PATH);

  const merged = await syncGuestData(request, session, client, changes);
  if (isDocumentRequest(request)) {
    // A flash left by a redirect (or the merge just retried): this page shows it once.
    flash = merged ?? (request.cookies.get(FLASH_COOKIE)?.value || null);
    if (flash) changes.flash = "";
  } else if (merged) {
    changes.flash = merged; // the client controller shows it
  }

  if (isGuestOnlyPath(pathname) && session.accessToken) {
    const verdict = await verifyAccess(session.accessToken, client);
    if (verdict === "valid")
      return redirectTo(safeNext(searchParams.get("next")) as Route);
    if (verdict === "invalid") changes.apply(clearedSessionCookieSpecs());
  }

  const ownedPage = isDocumentRequest(request)
    ? (orderRoute(pathname) ?? addressRoute(pathname, searchParams))
    : null;
  if (ownedPage && session.accessToken) {
    const verdict =
      ownedPage.action === "not-found"
        ? "missing"
        : pathname.startsWith("/account/addresses")
          ? await addressOwnership(ownedPage.id, session.accessToken, client)
          : await orderOwnership(ownedPage.id, session.accessToken, client);
    if (verdict === "missing") {
      const response = NextResponse.rewrite(
        new URL(NOT_FOUND_PATH, request.url),
        { ...forward(), status: 404 },
      );
      response.headers.set(ORDER_CHECK_HEADER, "missing");
      return changes.writeTo(response);
    }
  }

  const route = isDocumentRequest(request)
    ? catalogRoute(pathname, searchParams)
    : null;
  if (route?.action === "redirect") return redirectTo(route.location, 308);
  if (route) {
    // "not-found": an invalid list page (…/page/0); "check": ask the backend.
    const result =
      route.action === "check" ? await existence.check(route.check) : "missing";
    const response =
      result === "missing"
        ? NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url), {
            ...forward(),
            status: 404,
          })
        : NextResponse.next(forward());
    // Which requests were checked (e2e: documents yes, client navigations no).
    response.headers.set(CATALOG_CHECK_HEADER, result);
    return changes.writeTo(response);
  }
  return changes.writeTo(NextResponse.next(forward()));
}

// Pages and RSC requests; no static files, images, API routes or prefetches (router,
// segment and browser prefetches). The matcher must be literal (statically analyzed).
export const config = {
  matcher: [
    {
      source: "/((?!_next/|api/|.*\\.[A-Za-z0-9]+$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "next-router-segment-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
        { type: "header", key: "sec-purpose", value: "prefetch.*" },
      ],
    },
  ],
};
