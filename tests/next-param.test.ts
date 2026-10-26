import { describe, expect, it } from "vitest";

import { safeNext, withNext } from "@/lib/auth/next-param";

describe("safeNext", () => {
  it.each([
    ["/", "/"],
    ["/account", "/account"],
    ["/c/care?brand=lumi#top", "/c/care?brand=lumi#top"],
    ["/checkout/success/12", "/checkout/success/12"],
    ["/a/../account", "/account"],
  ])("keeps the same-site path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    "//evil.example",
    "//evil.example/account",
    "/\\evil.example",
    "\\\\evil.example",
    "https://evil.example",
    "http:/evil.example",
    "javascript:alert(1)",
    "evil.example",
    "account",
    "/\t/evil.example",
    "/\n/evil.example",
    "",
    "/" + "a".repeat(3000),
  ])("rejects %j", (input) => {
    expect(safeNext(input)).toBe("/");
  });

  it("never leaves the site, whatever the input", () => {
    for (const input of ["/%2F%2Fevil.example", "/%5Cevil.example", "/./"]) {
      const result = safeNext(input);
      expect(result.startsWith("//")).toBe(false);
      expect(new URL(result, "http://lamsa.test").host).toBe("lamsa.test");
    }
  });

  it("rejects non-strings", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext(["/account"])).toBe("/");
    expect(safeNext(42)).toBe("/");
  });
});

describe("withNext", () => {
  it("adds an encoded, validated next", () => {
    expect(withNext("/login", "/account/orders?x=1")).toBe(
      "/login?next=%2Faccount%2Forders%3Fx%3D1",
    );
    expect(withNext("/login", "/")).toBe("/login");
    expect(withNext("/login", "//evil.example")).toBe("/login");
  });
});
