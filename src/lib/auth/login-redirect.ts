import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/errors";

import { LOGIN_PATH } from "./paths";
import { withNext } from "./next-param";

/** The session ended while a server action ran (401: no token, expired, revoked). */
export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** Sends the visitor to /login and back to `path` afterwards (safe `next`, see safeNext). */
export function redirectToLogin(path: string): never {
  redirect(withNext(LOGIN_PATH, path) as Route);
}
