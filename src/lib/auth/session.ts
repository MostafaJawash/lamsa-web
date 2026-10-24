import "server-only";

import { cookies } from "next/headers";

import { isProduction } from "@/lib/env";

/**
 * Session cookies (BFF). The browser never sees the tokens: they live in httpOnly
 * cookies on the website's own domain and only server code reads them.
 *
 * - Access token: 15 minutes (`expires_in` from the TokenPair).
 * - Refresh token: 60 days; each one works once (rotate on every refresh).
 *
 * In production the names use the `__Host-` prefix (Secure, path "/", no Domain),
 * so no subdomain can set or overwrite them. Locally (http) the prefix is omitted.
 *
 * Cookies can only be written from server actions and route handlers, not while
 * rendering a server component. Flow logic (login, refresh, logout) lives in
 * `src/features/auth` and `src/app/api/auth/*`, not here.
 */
const COOKIE_PREFIX = isProduction ? "__Host-" : "";

export const ACCESS_TOKEN_COOKIE = `${COOKIE_PREFIX}lamsa_at`;
export const REFRESH_TOKEN_COOKIE = `${COOKIE_PREFIX}lamsa_rt`;

/** Fallback lifetimes; prefer `expires_in` from the backend. */
export const ACCESS_TOKEN_MAX_AGE = 15 * 60;
export const REFRESH_TOKEN_MAX_AGE = 60 * 24 * 60 * 60;

export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export function sessionCookieOptions(maxAge: number): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export type SessionTokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

export async function getAccessToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  return (await cookies()).get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}

export async function getSessionTokens(): Promise<SessionTokens> {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_TOKEN_COOKIE)?.value ?? null,
    refreshToken: store.get(REFRESH_TOKEN_COOKIE)?.value ?? null,
  };
}

/** Stores a new token pair. Server actions and route handlers only. */
export async function setSessionTokens(tokens: {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}): Promise<void> {
  const store = await cookies();
  store.set(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    sessionCookieOptions(tokens.expiresIn ?? ACCESS_TOKEN_MAX_AGE),
  );
  store.set(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    sessionCookieOptions(REFRESH_TOKEN_MAX_AGE),
  );
}

/** Removes both cookies. Server actions and route handlers only. */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_TOKEN_COOKIE, "", sessionCookieOptions(0));
  store.set(REFRESH_TOKEN_COOKIE, "", sessionCookieOptions(0));
}
