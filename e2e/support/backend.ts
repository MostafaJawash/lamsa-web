import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Direct calls to the running FastAPI backend, for test setup and cleanup only (the
 * site itself never exposes tokens). Accounts made by the tests are named "e2e-…" and
 * deleted at the end of each test (see `accounts` in ./fixtures.ts).
 */
export const API =
  process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";
export const BACKEND_DIR = resolve(process.cwd(), "../lamsa-backend");
export const PASSWORD = "E2e-pass-1234";

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  user: { id: number; name: string; phone: string | null };
};

export class BackendError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

export async function call<T>(
  method: string,
  path: string,
  { token, body }: { token?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code =
      (json as { error?: { code?: string } } | null)?.error?.code ?? "HTTP";
    throw new BackendError(response.status, code);
  }
  return json as T;
}

/** A valid, unused German mobile number: national (as typed with +49) and E.164. */
export function uniquePhone(): { national: string; e164: string } {
  const rest = String(randomInt(10_000_000, 99_999_999));
  return { national: `151${rest}`, e164: `+49151${rest}` };
}

/** A per-test visitor IP (TEST-NET-2), sent as X-Real-IP so login limits don't collide. */
export function uniqueIp(): string {
  return `198.51.${randomInt(0, 255)}.${randomInt(1, 254)}`;
}

export function registerViaApi(
  name: string,
  phone: string,
  password = PASSWORD,
): Promise<TokenPair> {
  return call<TokenPair>("POST", "/auth/register", {
    body: { name, phone, password },
  });
}

export function loginViaApi(
  phone: string,
  password: string,
): Promise<TokenPair> {
  return call<TokenPair>("POST", "/auth/login", { body: { phone, password } });
}

/**
 * DELETE /users/me with `token`. A pending temporary password blocks it
 * (PASSWORD_CHANGE_REQUIRED): change it first, then delete with the new pair.
 */
async function deleteWithToken(token: string, password: string): Promise<void> {
  try {
    await call("DELETE", "/users/me", {
      token,
      body: { current_password: password },
    });
  } catch (error) {
    if (
      !(error instanceof BackendError) ||
      error.code !== "PASSWORD_CHANGE_REQUIRED"
    )
      throw error;
    const cleanup = `E2e-cleanup-${Date.now()}`;
    const pair = await call<TokenPair>("POST", "/auth/password/change", {
      token,
      body: { current_password: password, new_password: cleanup },
    });
    await call("DELETE", "/users/me", {
      token: pair.access_token,
      body: { current_password: cleanup },
    });
  }
}

/**
 * Deletes a phone account; fine if it is already gone or the password changed.
 * `token`: an access token from earlier (a phone locked by TOO_MANY_ATTEMPTS can't log
 * in for 15 minutes).
 */
export async function deletePhoneAccount(
  phone: string,
  passwords: readonly string[],
  token?: string,
): Promise<boolean> {
  if (token) {
    for (const password of passwords) {
      try {
        await deleteWithToken(token, password);
        return true;
      } catch (error) {
        // Wrong password for this token, or the token was revoked: try the next way.
        if (!(error instanceof BackendError)) throw error;
      }
    }
  }
  for (const password of passwords) {
    try {
      const pair = await loginViaApi(phone, password);
      await deleteWithToken(pair.access_token, password);
      return true;
    } catch (error) {
      if (!(error instanceof BackendError) || error.status !== 401) throw error;
    }
  }
  return false;
}

type AdminUser = {
  id: number;
  name: string;
  phone: string;
  auth_provider: "phone" | "google";
  created_at: string;
  is_active: boolean;
};

type AdminUserPage = { items: AdminUser[]; pages: number };

/** Removes stale e2e phone accounts through the same public/admin APIs used by tests. */
export async function deleteStaleE2eAccounts(
  adminPhone: string,
  adminPassword: string,
  olderThan: Date,
): Promise<number> {
  const admin = await loginViaApi(adminPhone, adminPassword);
  let removed = 0;
  let page = 1;
  let pages = 1;
  const stale: AdminUser[] = [];
  do {
    const users = await call<AdminUserPage>(
      "GET",
      `/admin/users?search=e2e-&page=${page}&page_size=100`,
      { token: admin.access_token },
    );
    pages = users.pages;
    stale.push(
      ...users.items.filter(
        (user) =>
          user.name.startsWith("e2e-") &&
          new Date(user.created_at) < olderThan &&
          user.phone !== adminPhone,
      ),
    );
    page += 1;
  } while (page <= pages);
  const googleSubs = staleGoogleSubs(olderThan);
  for (const user of stale) {
    if (!user.is_active)
      await call("PATCH", `/admin/users/${user.id}`, {
        token: admin.access_token,
        body: { is_active: true },
      });
    if (user.auth_provider === "google") {
      const sub = googleSubs.get(user.id);
      if (sub && (await deleteGoogleAccount(sub))) removed += 1;
    } else {
      const reset = await call<{ temporary_password: string }>(
        "POST",
        `/admin/users/${user.id}/reset-password`,
        { token: admin.access_token },
      );
      if (await deletePhoneAccount(user.phone, [reset.temporary_password]))
        removed += 1;
    }
  }
  return removed;
}

function staleGoogleSubs(olderThan: Date): Map<number, string> {
  const script = `
import asyncio, json, sys
from sqlalchemy import text
from app.db.session import SessionLocal, engine
async def main():
    try:
        async with SessionLocal() as session:
            rows = (await session.execute(text("SELECT id, google_sub FROM users WHERE name LIKE 'e2e-%' AND auth_provider = 'google' AND created_at < :cutoff"), {"cutoff": sys.argv[1]})).all()
            print(json.dumps([list(row) for row in rows]))
    finally:
        await engine.dispose()
asyncio.run(main())
`;
  const output = execFileSync(
    backendPython(),
    ["-c", script, olderThan.toISOString().replace("T", " ").replace("Z", "")],
    {
      cwd: BACKEND_DIR,
      encoding: "utf8",
      env: { ...process.env, DEBUG: "false", PYTHONIOENCODING: "utf-8" },
    },
  );
  return new Map(
    (JSON.parse(output) as [number, string][]).map(([id, storedSub]) => [
      id,
      storedSub.startsWith("dev-") ? storedSub.slice(4) : storedSub,
    ]),
  );
}

export function devGoogleToken(sub: string, name = "مستخدم تجريبي"): string {
  return `dev-google|${sub}|dev-${sub}@example.test|${name}`;
}

/** Deletes the dev Google account of `sub`, if it was created. */
export async function deleteGoogleAccount(sub: string): Promise<boolean> {
  const result = await call<{ registered: boolean; tokens?: TokenPair }>(
    "POST",
    "/auth/google",
    { body: { id_token: devGoogleToken(sub) } },
  );
  if (!result.registered || !result.tokens) return false;
  await call("DELETE", "/users/me", { token: result.tokens.access_token });
  return true;
}

function backendPython(): string {
  const windows = join(BACKEND_DIR, "venv", "Scripts", "python.exe");
  return existsSync(windows)
    ? windows
    : join(BACKEND_DIR, "venv", "bin", "python");
}

/** Promotes a registered user with the backend's own script (scripts.make_admin). */
export function makeAdmin(phone: string): void {
  execFileSync(
    backendPython(),
    ["-m", "scripts.make_admin", "--phone", phone],
    {
      cwd: BACKEND_DIR,
      stdio: "pipe",
      env: { ...process.env, DEBUG: "false" },
    },
  );
}

export async function backendUp(): Promise<boolean> {
  try {
    const response = await fetch(API.replace(/\/api\/v1$/, "/health"));
    return response.ok;
  } catch {
    return false;
  }
}
