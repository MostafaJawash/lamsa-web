import "server-only";

import { cookies } from "next/headers";

import { isProduction } from "@/lib/env";
import type { Schema } from "@/lib/api/types";

/**
 * Session cookies (BFF). The browser never sees a token: they live in httpOnly cookies
 * on the website's own domain and only server code reads them.
 *
 * - access token: maxAge = `expires_in` (15 minutes); refreshed by src/proxy.ts.
 * - refresh token: maxAge = `refresh_expires_in` (60 days); each one works once.
 * - password-change flag: set while `user.must_change_password` is true, so the proxy
 *   can send the visitor to /account/change-password without calling the backend.
 * - Google signup: the `signup_token` (+ the Google name for the form) for 10 minutes.
 *
 * All httpOnly, SameSite=Lax, path "/". In production Secure with the `__Host-` prefix
 * (no Domain), so no subdomain can set or overwrite them; locally (http) without it.
 *
 * Cookies are written by server actions (`setSession`, via `cookies()`) and by the
 * proxy (`*CookieSpecs` on the NextResponse); never while rendering a server component.
 */
type TokenPair = Schema<"TokenPair">;

export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export type CookieSpec = {
  name: string;
  value: string;
  options: SessionCookieOptions;
};

export function cookieConfig(production: boolean) {
  const prefix = production ? "__Host-" : "";
  return {
    names: {
      access: `${prefix}lamsa_at`,
      refresh: `${prefix}lamsa_rt`,
      passwordChange: `${prefix}lamsa_pwc`,
      signup: `${prefix}lamsa_su`,
    },
    options(maxAge: number): SessionCookieOptions {
      return {
        httpOnly: true,
        secure: production,
        sameSite: "lax",
        path: "/",
        maxAge,
      };
    },
  };
}

const config = cookieConfig(isProduction);

export const ACCESS_TOKEN_COOKIE = config.names.access;
export const REFRESH_TOKEN_COOKIE = config.names.refresh;
export const PASSWORD_CHANGE_COOKIE = config.names.passwordChange;
export const SIGNUP_COOKIE = config.names.signup;
/** Development only: the stable fake Google subject of the dev sign-in button. */
export const DEV_GOOGLE_COOKIE = "lamsa_devg";

/** Lifetime of the Google signup cookie (the backend's SIGNUP_TOKEN_MINUTES). */
export const SIGNUP_MAX_AGE = 10 * 60;

export const sessionCookieOptions = config.options;

/** The cookies to set for a new token pair (login, register, refresh, password change). */
export function sessionCookieSpecs(pair: TokenPair): CookieSpec[] {
  const specs: CookieSpec[] = [
    {
      name: ACCESS_TOKEN_COOKIE,
      value: pair.access_token,
      options: config.options(pair.expires_in),
    },
    {
      name: REFRESH_TOKEN_COOKIE,
      value: pair.refresh_token,
      options: config.options(pair.refresh_expires_in),
    },
  ];
  specs.push(
    pair.user.must_change_password
      ? {
          name: PASSWORD_CHANGE_COOKIE,
          value: "1",
          options: config.options(pair.refresh_expires_in),
        }
      : { name: PASSWORD_CHANGE_COOKIE, value: "", options: config.options(0) },
  );
  return specs;
}

/** Expired copies of every session cookie (logout, revoked session). */
export function clearedSessionCookieSpecs(): CookieSpec[] {
  return [
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
    PASSWORD_CHANGE_COOKIE,
  ].map((name) => ({ name, value: "", options: config.options(0) }));
}

export type SessionTokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

export async function readTokens(): Promise<SessionTokens> {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_TOKEN_COOKIE)?.value || null,
    refreshToken: store.get(REFRESH_TOKEN_COOKIE)?.value || null,
  };
}

export async function getAccessToken(): Promise<string | null> {
  return (await readTokens()).accessToken;
}

/** Stores a new token pair. Server actions only. */
export async function setSession(pair: TokenPair): Promise<void> {
  const store = await cookies();
  for (const spec of sessionCookieSpecs(pair))
    store.set(spec.name, spec.value, spec.options);
}

/** Removes the session cookies. Server actions only. */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  for (const spec of clearedSessionCookieSpecs())
    store.set(spec.name, spec.value, spec.options);
}

/** What the Google signup cookie holds: the token and the name/email for the form. */
export type GoogleSignup = {
  signupToken: string;
  name: string | null;
  email: string | null;
};

export async function setGoogleSignup(signup: GoogleSignup): Promise<void> {
  const value = Buffer.from(JSON.stringify(signup), "utf8").toString(
    "base64url",
  );
  (await cookies()).set(SIGNUP_COOKIE, value, config.options(SIGNUP_MAX_AGE));
}

export async function readGoogleSignup(): Promise<GoogleSignup | null> {
  const raw = (await cookies()).get(SIGNUP_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (typeof parsed !== "object" || parsed === null) return null;
    const { signupToken, name, email } = parsed as Record<string, unknown>;
    if (typeof signupToken !== "string" || !signupToken) return null;
    return {
      signupToken,
      name: typeof name === "string" ? name : null,
      email: typeof email === "string" ? email : null,
    };
  } catch {
    return null;
  }
}

export async function clearGoogleSignup(): Promise<void> {
  (await cookies()).set(SIGNUP_COOKIE, "", config.options(0));
}
