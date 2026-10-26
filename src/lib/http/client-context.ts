import "server-only";

import { isIP } from "node:net";

import { headers } from "next/headers";

import { env } from "@/lib/env";

/**
 * Who the visitor is, as far as the backend needs to know: every server-side call to
 * FastAPI forwards these (X-Forwarded-For, User-Agent, X-Request-ID), so its per-IP
 * login limits and session list see the visitor, not this server. The backend reads
 * X-Forwarded-For only because this server is in its TRUSTED_PROXY_IPS.
 */
export type ClientContext = {
  ip: string;
  userAgent: string | null;
  /** null: none known (the backend makes its own). */
  requestId: string | null;
};

/** The IP used when the visitor's address can't be known (development). */
export const LOCAL_IP = "127.0.0.1";

export const REQUEST_ID_HEADER = "x-request-id";

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

function validIp(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

/**
 * The visitor's IP. With `trustProxy` (production behind our Nginx), X-Real-IP or the
 * rightmost X-Forwarded-For entry, both set by Nginx from the socket address. Without
 * it, always 127.0.0.1: a browser-supplied X-Forwarded-For is never passed on.
 */
export function clientIpFrom(
  requestHeaders: Headers,
  trustProxy: boolean,
): string {
  if (!trustProxy) return LOCAL_IP;
  const realIp = validIp(requestHeaders.get("x-real-ip"));
  if (realIp) return realIp;
  const forwarded = (requestHeaders.get("x-forwarded-for") ?? "").split(",");
  return validIp(forwarded.at(-1)) ?? LOCAL_IP;
}

/**
 * The request id src/proxy.ts stamped on the request (it overwrites whatever the
 * browser sent), or null (prefetches skip the proxy). Never random here: this runs
 * while rendering, where Next.js rejects random values in prerenders.
 */
export function requestIdFrom(requestHeaders: Headers): string | null {
  const incoming = requestHeaders.get(REQUEST_ID_HEADER);
  return incoming && VALID_REQUEST_ID.test(incoming) ? incoming : null;
}

/**
 * The id src/proxy.ts stamps on every request it forwards: Nginx's X-Request-ID when we
 * are behind it (`trustProxy`), otherwise a new one (a browser-sent id is not reused).
 */
export function proxyRequestId(
  requestHeaders: Headers,
  trustProxy: boolean,
): string {
  const incoming = requestHeaders.get(REQUEST_ID_HEADER);
  return trustProxy && incoming && VALID_REQUEST_ID.test(incoming)
    ? incoming
    : crypto.randomUUID();
}

export function clientContextFrom(
  requestHeaders: Headers,
  trustProxy: boolean = env.WEB_TRUST_PROXY_HEADERS,
): ClientContext {
  return {
    ip: clientIpFrom(requestHeaders, trustProxy),
    userAgent: requestHeaders.get("user-agent"),
    requestId: requestIdFrom(requestHeaders),
  };
}

/** The current request's context (server components, server actions). */
export async function getClientContext(): Promise<ClientContext> {
  return clientContextFrom(await headers());
}
