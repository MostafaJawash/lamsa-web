import "server-only";

import createClient, { type Client, type Middleware } from "openapi-fetch";

import { getAccessToken } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { ApiError, isApiErrorBody } from "@/lib/errors";

import type { paths as GeneratedPaths } from "./schema";

/**
 * Server-only FastAPI client (BFF): server components, server actions and route
 * handlers call the backend through this; the browser never does.
 *
 * `API_BASE_URL` already ends in `/api/v1`, so the generated paths are re-keyed
 * without that prefix: `api.GET("/products")`, as in the backend README.
 */
type ApiPrefix = "/api/v1";
export type ApiPaths = {
  [
    P in keyof GeneratedPaths as P extends `${ApiPrefix}${infer Rest}`
      ? Rest
      : never
  ]: GeneratedPaths[P];
};
export type ApiClient = Client<ApiPaths>;

export const API_TIMEOUT_MS = 10_000;

/**
 * Shorter limit for reads that block a page section (home, navigation). Pass it per
 * request: `publicApi.GET("/banners", { signal: pageTimeout() })`.
 */
export const PAGE_TIMEOUT_MS = 4_000;

export function pageTimeout(): AbortSignal {
  return AbortSignal.timeout(PAGE_TIMEOUT_MS);
}

/** Adds a timeout and turns network failures into `ApiError`s (status 0). */
async function fetchWithTimeout(request: Request): Promise<Response> {
  const signal = AbortSignal.any([
    request.signal,
    AbortSignal.timeout(API_TIMEOUT_MS),
  ]);
  try {
    return await fetch(request, { signal });
  } catch (cause) {
    const timedOut =
      cause instanceof DOMException && cause.name === "TimeoutError";
    throw new ApiError(0, timedOut ? "TIMEOUT" : "NETWORK_ERROR", null);
  }
}

function bearer(accessToken: string): Middleware {
  return {
    onRequest({ request }) {
      request.headers.set("Authorization", `Bearer ${accessToken}`);
      return request;
    },
  };
}

// TODO(auth): forward the visitor's IP (X-Forwarded-For) so the backend's per-IP login
// rate limits see real clients, not this server; the backend must then run with
// TRUST_PROXY_HEADERS=true behind a proxy that only this server can reach.

export function createApiClient(
  options: { accessToken?: string | null } = {},
): ApiClient {
  const client = createClient<ApiPaths>({
    baseUrl: env.API_BASE_URL,
    fetch: fetchWithTimeout,
    headers: { Accept: "application/json" },
  });
  if (options.accessToken) client.use(bearer(options.accessToken));
  return client;
}

/**
 * Anonymous client for public catalog data. Reads no cookies, so it can be used
 * inside `"use cache"` functions.
 */
export const publicApi: ApiClient = createApiClient();

/**
 * Client that sends the visitor's access token when there is one. Reads cookies, so
 * the calling component must render inside a `<Suspense>` boundary (Cache Components).
 */
export async function getApi(): Promise<ApiClient> {
  return createApiClient({ accessToken: await getAccessToken() });
}

type FetchResult<T> = { data?: T; error?: unknown; response: Response };

/** Maps any failed response to a typed `ApiError` (backend format `{error: {code, message, details}}`). */
export function toApiError(response: Response, body: unknown): ApiError {
  const retryAfterHeader = response.headers.get("Retry-After");
  const retryAfter = retryAfterHeader
    ? Number.parseInt(retryAfterHeader, 10)
    : null;
  if (isApiErrorBody(body)) {
    const { code, message, details } = body.error;
    return new ApiError(
      response.status,
      code,
      typeof message === "string" && message ? message : null,
      details ?? null,
      Number.isFinite(retryAfter) ? retryAfter : null,
    );
  }
  return new ApiError(response.status, "HTTP_ERROR", null, null, null);
}

/**
 * Returns `data` or throws an `ApiError`:
 * `const page = await unwrap(publicApi.GET("/products", { params: { query } }))`.
 */
export async function unwrap<T>(request: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await request;
  if (!response.ok) throw toApiError(response, error);
  return data as T;
}
