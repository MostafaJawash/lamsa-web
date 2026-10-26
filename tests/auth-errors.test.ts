import { describe, expect, it } from "vitest";

import { mapAuthError } from "@/features/auth/errors";
import { ApiError } from "@/lib/errors";

const msg = "رسالة الخادم";

function apiError(
  code: string,
  extra: {
    details?: unknown;
    retryAfter?: number;
    message?: string | null;
  } = {},
) {
  return new ApiError(
    400,
    code,
    extra.message === undefined ? msg : extra.message,
    extra.details ?? null,
    extra.retryAfter ?? null,
  );
}

describe("mapAuthError", () => {
  it.each(["PHONE_TAKEN", "INVALID_PHONE"])("%s → phone field", (code) => {
    expect(mapAuthError(apiError(code))).toMatchObject({
      fieldErrors: { phone: msg },
      formError: null,
    });
  });

  it.each(["WEAK_PASSWORD", "SAME_PASSWORD"])("%s → password field", (code) => {
    expect(mapAuthError(apiError(code)).fieldErrors).toEqual({ password: msg });
    expect(
      mapAuthError(apiError(code), { passwordField: "newPassword" })
        .fieldErrors,
    ).toEqual({ newPassword: msg });
  });

  it("INVALID_CREDENTIALS → form error (or the current password field)", () => {
    expect(mapAuthError(apiError("INVALID_CREDENTIALS")).formError).toEqual({
      kind: "generic",
      message: msg,
    });
    expect(
      mapAuthError(apiError("INVALID_CREDENTIALS"), {
        credentialsField: "currentPassword",
      }).fieldErrors,
    ).toEqual({ currentPassword: msg });
  });

  it("ALREADY_REGISTERED → form error with the login link", () => {
    expect(mapAuthError(apiError("ALREADY_REGISTERED")).formError?.kind).toBe(
      "alreadyRegistered",
    );
  });

  it("TOO_MANY_ATTEMPTS → countdown from Retry-After or details.retry_after", () => {
    expect(
      mapAuthError(apiError("TOO_MANY_ATTEMPTS", { retryAfter: 37 })),
    ).toMatchObject({
      formError: { kind: "rateLimited", message: msg },
      retryAfter: 37,
    });
    expect(
      mapAuthError(
        apiError("TOO_MANY_ATTEMPTS", { details: { retry_after: 12.2 } }),
      ).retryAfter,
    ).toBe(13);
  });

  it("ACCOUNT_DISABLED → form error with the support contact", () => {
    expect(mapAuthError(apiError("ACCOUNT_DISABLED")).formError?.kind).toBe(
      "disabled",
    );
  });

  it("expired Google signup → start again", () => {
    expect(
      mapAuthError(apiError("TOKEN_EXPIRED"), { signup: true }).formError?.kind,
    ).toBe("signupExpired");
    expect(mapAuthError(apiError("TOKEN_EXPIRED")).formError?.kind).toBe(
      "generic",
    );
  });

  it("VALIDATION_ERROR → details on their fields", () => {
    const error = apiError("VALIDATION_ERROR", {
      details: [
        { field: "phone", message: "رقم غلط" },
        { field: "new_password", message: "قصيرة" },
        { field: "device_name", message: "ignored" },
      ],
    });
    expect(mapAuthError(error).fieldErrors).toEqual({
      phone: "رقم غلط",
      newPassword: "قصيرة",
    });
    expect(
      mapAuthError(apiError("VALIDATION_ERROR", { details: [] })).formError
        ?.kind,
    ).toBe("generic");
  });

  it("prefers the backend message, falls back to the local one", () => {
    expect(
      mapAuthError(apiError("PHONE_TAKEN", { message: null })).fieldErrors
        .phone,
    ).toMatch(/[؀-ۿ]/);
    expect(
      mapAuthError(new ApiError(0, "NETWORK_ERROR", null)).formError?.message,
    ).toMatch(/[؀-ۿ]/);
    expect(mapAuthError(new Error("x")).formError?.kind).toBe("generic");
  });
});
