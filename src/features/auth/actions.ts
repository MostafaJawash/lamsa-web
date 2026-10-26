"use server";

/**
 * auth: server actions. Each one re-validates its input with the same zod schema as
 * the form, calls the backend through "@/lib/api/client" (with the visitor's IP), maps
 * failures with mapAuthError() and, on success, sets the session cookies and redirects
 * to the validated `next`. Tokens never leave the server: the client only gets an
 * AuthResult. Next.js checks the Origin of every server action.
 */
import { randomBytes } from "node:crypto";

import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { t } from "@/i18n";
import { getApi, unwrap } from "@/lib/api/client";
import type { Schema } from "@/lib/api/types";
import { withAccess } from "@/lib/auth/action-session";
import { needsRefresh } from "@/lib/auth/jwt";
import { safeNext, withNext } from "@/lib/auth/next-param";
import {
  ACCOUNT_PATH,
  CHANGE_PASSWORD_PATH,
  COMPLETE_PROFILE_PATH,
} from "@/lib/auth/paths";
import {
  clearGoogleSignup,
  clearSession,
  DEV_GOOGLE_COOKIE,
  readGoogleSignup,
  readTokens,
  sessionCookieOptions,
  setGoogleSignup,
  setSession,
} from "@/lib/auth/session";
import { ApiError } from "@/lib/errors";

import { failure, mapAuthError, type AuthResult } from "./errors";
import { devGoogleAvailable } from "./google";
import {
  changePasswordSchema,
  combinePhone,
  completeProfileSchema,
  fieldErrorsOf,
  loginSchema,
  registerSchema,
} from "./schemas";

type TokenPair = Schema<"TokenPair">;

/** SERVICE_BUSY: wait Retry-After (capped) and retry once, as the backend asks. */
const BUSY_RETRY_MAX_SECONDS = 5;

async function retryOnceIfBusy<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof ApiError) || !error.is("SERVICE_BUSY")) throw error;
    const seconds = Math.min(error.retryAfter ?? 1, BUSY_RETRY_MAX_SECONDS);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    return call();
  }
}

/** Stores the pair and leaves: to the password change first when it is required. */
async function signedIn(pair: TokenPair, next: unknown): Promise<never> {
  await setSession(pair);
  if (pair.user.must_change_password)
    redirect(withNext(CHANGE_PASSWORD_PATH, next) as Route);
  redirect(safeNext(next) as Route);
}

export async function login(
  input: unknown,
  next: unknown,
): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success)
    return failure({ fieldErrors: fieldErrorsOf(parsed.error) });
  const { countryCode, phone, password } = parsed.data;
  let pair: TokenPair;
  try {
    const api = await getApi({ accessToken: null });
    pair = await retryOnceIfBusy(() =>
      unwrap(
        api.POST("/auth/login", {
          body: { phone: combinePhone(countryCode, phone), password },
        }),
      ),
    );
  } catch (error) {
    return mapAuthError(error);
  }
  return signedIn(pair, next);
}

export async function register(
  input: unknown,
  next: unknown,
): Promise<AuthResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success)
    return failure({ fieldErrors: fieldErrorsOf(parsed.error) });
  const { name, countryCode, phone, password } = parsed.data;
  let pair: TokenPair;
  try {
    const api = await getApi({ accessToken: null });
    pair = await retryOnceIfBusy(() =>
      unwrap(
        api.POST("/auth/register", {
          body: { name, phone: combinePhone(countryCode, phone), password },
        }),
      ),
    );
  } catch (error) {
    return mapAuthError(error);
  }
  return signedIn(pair, next);
}

async function signInWithIdToken(
  idToken: string,
  next: unknown,
): Promise<AuthResult> {
  let result: Schema<"GoogleLoginResponse">;
  try {
    const api = await getApi({ accessToken: null });
    result = await retryOnceIfBusy(() =>
      unwrap(api.POST("/auth/google", { body: { id_token: idToken } })),
    );
  } catch (error) {
    return mapAuthError(error);
  }
  if (result.registered && result.tokens) return signedIn(result.tokens, next);
  if (!result.signup_token)
    return failure({
      formError: { kind: "generic", message: t("auth.google.failed") },
    });
  await setGoogleSignup({
    signupToken: result.signup_token,
    name: result.profile?.name ?? null,
    email: result.profile?.email ?? null,
  });
  redirect(withNext(COMPLETE_PROFILE_PATH, next) as Route);
}

/** The ID token (credential) from Google Identity Services. */
export async function googleSignIn(
  credential: unknown,
  next: unknown,
): Promise<AuthResult> {
  if (typeof credential !== "string" || !credential || credential.length > 8192)
    return failure({
      formError: { kind: "generic", message: t("auth.google.failed") },
    });
  return signInWithIdToken(credential, next);
}

/**
 * "دخول تجريبي بـ Google": a token in the backend's GOOGLE_DEV_MODE format,
 * `dev-google|<sub>|<email>|<name>`. The sub is random once and kept in a dev cookie,
 * so repeated clicks in the same browser are the same user.
 */
export async function devGoogleSignIn(next: unknown): Promise<AuthResult> {
  if (!devGoogleAvailable())
    return failure({
      formError: { kind: "generic", message: t("auth.google.failed") },
    });
  const store = await cookies();
  let sub = store.get(DEV_GOOGLE_COOKIE)?.value ?? "";
  if (!/^[a-f0-9]{16}$/.test(sub)) {
    sub = randomBytes(8).toString("hex");
    store.set(DEV_GOOGLE_COOKIE, sub, sessionCookieOptions(365 * 24 * 60 * 60));
  }
  const token = `dev-google|${sub}|dev-${sub}@example.test|${t("auth.google.devName")}`;
  return signInWithIdToken(token, next);
}

export async function completeProfile(
  input: unknown,
  next: unknown,
): Promise<AuthResult> {
  const parsed = completeProfileSchema.safeParse(input);
  if (!parsed.success)
    return failure({ fieldErrors: fieldErrorsOf(parsed.error) });
  const signup = await readGoogleSignup();
  if (!signup)
    return failure({
      formError: { kind: "signupExpired", message: t("auth.complete.expired") },
    });
  const { name, countryCode, phone } = parsed.data;
  let pair: TokenPair;
  try {
    const api = await getApi({ accessToken: null });
    pair = await retryOnceIfBusy(() =>
      unwrap(
        api.POST("/auth/google/complete", {
          body: {
            signup_token: signup.signupToken,
            name,
            phone: combinePhone(countryCode, phone),
          },
        }),
      ),
    );
  } catch (error) {
    const mapped = mapAuthError(error, { signup: true });
    if (mapped.formError?.kind === "signupExpired") await clearGoogleSignup();
    return mapped;
  }
  await clearGoogleSignup();
  return signedIn(pair, next);
}

export async function changePassword(
  input: unknown,
  next: unknown,
): Promise<AuthResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success)
    return failure({ fieldErrors: fieldErrorsOf(parsed.error) });
  const { currentPassword, newPassword } = parsed.data;
  let pair: TokenPair;
  try {
    pair = await withAccess((api) =>
      retryOnceIfBusy(() =>
        unwrap(
          api.POST("/auth/password/change", {
            body: {
              current_password: currentPassword,
              new_password: newPassword,
            },
          }),
        ),
      ),
    );
  } catch (error) {
    if (error instanceof ApiError && error.is("NOT_AUTHENTICATED"))
      redirect(withNext("/login", CHANGE_PASSWORD_PATH) as Route);
    return mapAuthError(error, {
      passwordField: "newPassword",
      credentialsField: "currentPassword",
    });
  }
  await setSession(pair);
  const target = safeNext(next);
  redirect((target === "/" ? ACCOUNT_PATH : target) as Route);
}

/**
 * Ends this session: POST /auth/logout with the refresh token (works even when the
 * access token has expired; the access token is sent only while still valid), then
 * clears the cookies whatever the backend said.
 */
export async function logout(): Promise<AuthResult> {
  const { accessToken, refreshToken } = await readTokens();
  if (refreshToken) {
    try {
      const usable =
        accessToken && !needsRefresh(accessToken) ? accessToken : null;
      const api = await getApi({ accessToken: usable });
      await api.POST("/auth/logout", { body: { refresh_token: refreshToken } });
    } catch {
      // The cookies go anyway; the refresh token expires on its own.
    }
  }
  await clearSession();
  redirect("/");
}

/** Ends every session of the user (POST /auth/logout-all), then like logout(). */
export async function logoutAll(): Promise<AuthResult> {
  try {
    await withAccess((api) => unwrap(api.POST("/auth/logout-all")));
  } catch (error) {
    if (!(error instanceof ApiError) || !error.is("NOT_AUTHENTICATED"))
      return mapAuthError(error);
  }
  await clearSession();
  redirect("/");
}
