import { describe, expect, it } from "vitest";

import { accessTokenExp, needsRefresh } from "@/lib/auth/jwt";

function token(payload: unknown): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

describe("accessTokenExp", () => {
  it("reads exp without verifying", () => {
    expect(accessTokenExp(token({ sub: "1", exp: 1_800_000_000 }))).toBe(
      1_800_000_000,
    );
  });

  it.each([
    "",
    "not-a-jwt",
    "a.b",
    "a.b.c.d",
    `x.${Buffer.from("not json").toString("base64url")}.y`,
    token({ sub: "1" }),
    token({ exp: "1800000000" }),
    token(null),
  ])("returns null for %j", (value) => {
    expect(accessTokenExp(value)).toBeNull();
  });
});

describe("needsRefresh", () => {
  const now = 1_800_000_000;

  it("refreshes when missing, unreadable or expiring within 60 s", () => {
    expect(needsRefresh(null, now)).toBe(true);
    expect(needsRefresh("garbage", now)).toBe(true);
    expect(needsRefresh(token({ exp: now - 1 }), now)).toBe(true);
    expect(needsRefresh(token({ exp: now + 60 }), now)).toBe(true);
  });

  it("keeps a token with more than 60 s left", () => {
    expect(needsRefresh(token({ exp: now + 61 }), now)).toBe(false);
    expect(needsRefresh(token({ exp: now + 900 }), now)).toBe(false);
  });
});
