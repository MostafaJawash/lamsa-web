import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { getMessages } from "@/i18n";
import {
  API_ERROR_CODES,
  ApiError,
  errorMessage,
  fallbackMessage,
  isApiErrorBody,
} from "@/lib/errors";

describe("API error codes", () => {
  it("has an Arabic fallback for every code", () => {
    const apiErrors: Record<string, string> = getMessages().apiErrors;
    for (const code of API_ERROR_CODES) {
      expect(apiErrors[code], code).toMatch(/[؀-ۿ]/);
    }
    expect(Object.keys(apiErrors).sort()).toEqual([...API_ERROR_CODES].sort());
  });

  // The backend checkout sits next to this repo locally; skipped where it does not (e.g. CI).
  const backendReadme = resolve(process.cwd(), "../lamsa-backend/README.md");

  it.skipIf(!existsSync(backendReadme))(
    "covers every code in the backend README",
    () => {
      const text = readFileSync(backendReadme, "utf8");
      const section = text.slice(
        text.indexOf("### Error format"),
        text.indexOf("## Catalog for app developers"),
      );
      const documented = [
        ...section.matchAll(/^\| [^|]+\| `([A-Z_]+)` \|/gm),
      ].map((m) => m[1]);
      expect(documented.length).toBeGreaterThan(50);
      expect([...API_ERROR_CODES].sort()).toEqual(
        [...new Set(documented)].sort(),
      );
    },
  );
});

describe("errorMessage", () => {
  it("prefers the backend's Arabic message", () => {
    const error = new ApiError(
      409,
      "PHONE_TAKEN",
      "رقم الهاتف مستخدم في حساب آخر.",
    );
    expect(errorMessage(error)).toBe("رقم الهاتف مستخدم في حساب آخر.");
  });

  it("falls back to the local text for the code", () => {
    expect(errorMessage(new ApiError(422, "CART_EMPTY", null))).toBe(
      fallbackMessage("CART_EMPTY"),
    );
    expect(errorMessage(new ApiError(422, "CART_EMPTY", "   "))).toBe(
      fallbackMessage("CART_EMPTY"),
    );
  });

  it("handles network failures, unknown codes and non-API errors", () => {
    expect(errorMessage(new ApiError(0, "NETWORK_ERROR", null))).toBe(
      getMessages().errors.network,
    );
    expect(errorMessage(new ApiError(0, "TIMEOUT", null))).toBe(
      getMessages().errors.timeout,
    );
    expect(errorMessage(new ApiError(418, "SOMETHING_NEW", null))).toBe(
      getMessages().errors.generic,
    );
    expect(errorMessage(new Error("boom"))).toBe(getMessages().errors.generic);
  });
});

describe("ApiError", () => {
  it("exposes validation details", () => {
    const error = new ApiError(422, "VALIDATION_ERROR", "بيانات غير صحيحة", [
      { field: "phone", message: "رقم غير صحيح" },
      { nope: true },
    ]);
    expect(error.is("VALIDATION_ERROR")).toBe(true);
    expect(error.validationDetails).toEqual([
      { field: "phone", message: "رقم غير صحيح" },
    ]);
  });

  it("recognizes the backend error body", () => {
    expect(
      isApiErrorBody({
        error: { code: "NOT_FOUND", message: "x", details: null },
      }),
    ).toBe(true);
    expect(isApiErrorBody({ detail: "Not Found" })).toBe(false);
    expect(isApiErrorBody(null)).toBe(false);
  });
});
