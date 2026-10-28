import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  combinePhone,
  loginSchema,
  passwordRules,
  phoneForms,
  registerSchema,
} from "@/features/auth/schemas";

describe("phone", () => {
  it("removes a trunk zero only for Syrian national numbers", () => {
    expect(combinePhone("+49", "0151 2345 6789")).toBe("+49015123456789");
    expect(combinePhone("+49", "151-2345-6789")).toBe("+4915123456789");
    expect(combinePhone("+963", "0933 123 456")).toBe("+963933123456");
  });

  it("keeps a number that is already international", () => {
    expect(combinePhone("+49", "+33 6 12 34 56 78")).toBe("+33 6 12 34 56 78");
    expect(combinePhone("+49", "0049151")).toBe("0049151");
  });

  it("validates the phone field", () => {
    const base = { countryCode: "+49", password: "x" };
    expect(
      loginSchema.safeParse({ ...base, phone: "1512 3456789" }).success,
    ).toBe(true);
    expect(loginSchema.safeParse({ ...base, phone: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ ...base, phone: "abc" }).success).toBe(
      false,
    );
    expect(loginSchema.safeParse({ ...base, phone: "12" }).success).toBe(false);
    expect(
      loginSchema.safeParse({
        ...base,
        countryCode: "+1",
        phone: "1512 3456789",
      }).success,
    ).toBe(false);
  });
});

describe("password rules (mirror the backend)", () => {
  const forms = phoneForms("+963", "0933 123456");

  it("8–128 characters", () => {
    expect(passwordRules("Abcdef1").length).toBe(false);
    expect(passwordRules("Abcdefg1").length).toBe(true);
    expect(passwordRules("a".repeat(129)).length).toBe(false);
  });

  it("not only digits (also Arabic-Indic digits)", () => {
    expect(passwordRules("12345678").notDigits).toBe(false);
    expect(passwordRules("١٢٣٤٥٦٧٨").notDigits).toBe(false);
    expect(passwordRules("1234567a").notDigits).toBe(true);
  });

  it("not the phone in any spelling", () => {
    for (const spelling of [
      "+963933123456",
      "0933123456",
      "00963 933 123456",
      "933123456",
    ])
      expect(passwordRules(spelling, forms).notPhone, spelling).toBe(false);
    expect(passwordRules("Secret-pass1", forms).notPhone).toBe(true);
  });

  it("register rejects the phone as password", () => {
    const result = registerSchema.safeParse({
      name: "e2e",
      countryCode: "+963",
      phone: "0933 123456",
      password: "+963933123456",
    });
    expect(result.success).toBe(false);
  });

  it("change password: confirmation and a new value", () => {
    const ok = {
      currentPassword: "Old-pass1",
      newPassword: "New-pass12",
      confirmPassword: "New-pass12",
    };
    expect(changePasswordSchema.safeParse(ok).success).toBe(true);
    expect(
      changePasswordSchema.safeParse({ ...ok, confirmPassword: "x" }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        ...ok,
        newPassword: "Old-pass1",
        confirmPassword: "Old-pass1",
      }).success,
    ).toBe(false);
  });
});
