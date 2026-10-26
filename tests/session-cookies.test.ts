import { describe, expect, it } from "vitest";

import type { Schema } from "@/lib/api/types";
import {
  ACCESS_TOKEN_COOKIE,
  clearedSessionCookieSpecs,
  cookieConfig,
  PASSWORD_CHANGE_COOKIE,
  REFRESH_TOKEN_COOKIE,
  sessionCookieSpecs,
} from "@/lib/auth/session";

function pair(mustChange = false): Schema<"TokenPair"> {
  return {
    access_token: "a.b.c",
    refresh_token: "r",
    token_type: "bearer",
    expires_in: 900,
    refresh_expires_in: 5_184_000,
    user: {
      id: 1,
      name: "e2e-x",
      phone: "+4915123456789",
      email: null,
      role: "customer",
      auth_provider: "phone",
      must_change_password: mustChange,
      created_at: "2026-10-26T10:00:00",
    },
  };
}

describe("cookie options per environment", () => {
  it("production: __Host- prefix, Secure, httpOnly, Lax, path /", () => {
    const config = cookieConfig(true);
    expect(config.names.access).toBe("__Host-lamsa_at");
    expect(config.names.refresh).toBe("__Host-lamsa_rt");
    expect(config.names.signup).toBe("__Host-lamsa_su");
    expect(config.names.passwordChange).toBe("__Host-lamsa_pwc");
    expect(config.options(900)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 900,
    });
  });

  it("development: no prefix and not Secure (http), otherwise the same", () => {
    const config = cookieConfig(false);
    expect(config.names.access).toBe("lamsa_at");
    expect(config.options(60)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60,
    });
  });
});

describe("session cookie specs", () => {
  it("uses the backend lifetimes for both tokens", () => {
    const byName = Object.fromEntries(
      sessionCookieSpecs(pair()).map((spec) => [spec.name, spec]),
    );
    expect(byName[ACCESS_TOKEN_COOKIE]?.value).toBe("a.b.c");
    expect(byName[ACCESS_TOKEN_COOKIE]?.options.maxAge).toBe(900);
    expect(byName[REFRESH_TOKEN_COOKIE]?.options.maxAge).toBe(5_184_000);
    // No pending password change: the flag cookie is removed.
    expect(byName[PASSWORD_CHANGE_COOKIE]?.options.maxAge).toBe(0);
  });

  it("sets the password-change flag while a temporary password is in use", () => {
    const flag = sessionCookieSpecs(pair(true)).find(
      (spec) => spec.name === PASSWORD_CHANGE_COOKIE,
    );
    expect(flag?.value).toBe("1");
    expect(flag?.options.maxAge).toBe(5_184_000);
  });

  it("clears every session cookie", () => {
    const specs = clearedSessionCookieSpecs();
    expect(specs.map((spec) => spec.name).sort()).toEqual(
      [
        ACCESS_TOKEN_COOKIE,
        PASSWORD_CHANGE_COOKIE,
        REFRESH_TOKEN_COOKIE,
      ].sort(),
    );
    expect(
      specs.every((spec) => spec.options.maxAge === 0 && spec.value === ""),
    ).toBe(true);
  });
});
