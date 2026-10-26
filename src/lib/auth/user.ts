import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getApi, pageTimeout } from "@/lib/api/client";
import type { Schema } from "@/lib/api/types";

import { CHANGE_PASSWORD_PATH, LOGIN_PATH } from "./paths";
import { withNext } from "./next-param";
import { readTokens } from "./session";

export type User = Schema<"UserOut">;

export type SessionState =
  | { status: "user"; user: User }
  | { status: "guest" }
  /** A token exists but the backend couldn't be asked: don't redirect, show a notice. */
  | { status: "unavailable" };

/**
 * The visitor's session, read once per request (React `cache()`): the access cookie
 * (already refreshed by src/proxy.ts when it was close to expiring) and GET /users/me.
 * Never throws for auth problems. Reads cookies: render inside <Suspense>.
 */
export const getSession = cache(async (): Promise<SessionState> => {
  const { accessToken } = await readTokens();
  if (!accessToken) return { status: "guest" };
  try {
    const api = await getApi({ accessToken });
    const { data, response } = await api.GET("/users/me", {
      signal: pageTimeout(),
    });
    if (response.ok && data) return { status: "user", user: data };
    // 401 (expired, revoked, deleted user) or 403 ACCOUNT_DISABLED.
    if (response.status === 401 || response.status === 403)
      return { status: "guest" };
    return { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
});

/** The signed-in user, or null (guest, or the backend can't be reached). */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  return session.status === "user" ? session.user : null;
}

/**
 * For pages that need a user (`path` is the page's own path, for `next`): guests go to
 * /login?next=…, a user with a temporary password to /account/change-password. The
 * proxy already does this optimistically from the cookies; this is the real check.
 * Returns null when the backend is unavailable (the page shows a notice).
 */
export async function requireUser(path: string): Promise<User | null> {
  const session = await getSession();
  if (session.status === "guest") redirect(withNext(LOGIN_PATH, path) as Route);
  if (session.status === "unavailable") return null;
  if (session.user.must_change_password && path !== CHANGE_PASSWORD_PATH)
    redirect(withNext(CHANGE_PASSWORD_PATH, path) as Route);
  return session.user;
}
