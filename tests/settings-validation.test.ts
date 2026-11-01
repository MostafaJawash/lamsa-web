import { describe, expect, it } from "vitest";

import {
  isSessionGone,
  mapPasswordError,
  mapPhoneError,
  mapProfileError,
} from "@/features/account/settings-errors";
import {
  EMAIL_MAX,
  hasErrors,
  isEmailLike,
  newPhone,
  readPasswordForm,
  readPhoneForm,
  readProfileForm,
  validatePasswordChange,
  validatePhoneChange,
  validateProfile,
} from "@/features/account/settings-validation";
import { combinePhone } from "@/features/auth/schemas";
import { ApiError } from "@/lib/errors";

const msg = "رسالة الخادم";
const failure = (code: string, details: unknown = null, status = 400) =>
  new ApiError(status, code, msg, details);

describe("validateProfile (mirrors UserUpdate)", () => {
  it("accepts a name alone; the email is optional", () => {
    expect(validateProfile({ name: "ليلى", email: "" })).toEqual({});
    expect(validateProfile({ name: "ليلى", email: "  " })).toEqual({});
  });

  it("requires a name, trimmed, up to 100 characters", () => {
    expect(validateProfile({ name: "   ", email: "" }).name).toBe("اكتب اسمك.");
    expect(validateProfile({ name: "ا".repeat(100), email: "" })).toEqual({});
    expect(validateProfile({ name: "ا".repeat(101), email: "" }).name).toBe(
      "الاسم طويل جدًا.",
    );
  });

  it("checks the shape of an email and its length", () => {
    expect(validateProfile({ name: "ا", email: "a@example.com" })).toEqual({});
    for (const bad of ["a", "a@", "@b.com", "a b@c.com", "a@b", "a@@b.com"])
      expect(validateProfile({ name: "ا", email: bad }).email, bad).toBe(
        "البريد الإلكتروني غير صحيح.",
      );
    const long = `${"a".repeat(EMAIL_MAX)}@example.com`;
    expect(validateProfile({ name: "ا", email: long }).email).toContain(
      String(EMAIL_MAX),
    );
  });

  it("isEmailLike is a shape check only", () => {
    expect(isEmailLike("x.y+z@sub.example.co")).toBe(true);
    expect(isEmailLike("x@y")).toBe(false);
  });
});

describe("validatePhoneChange (the auth forms' phone rule, reused)", () => {
  const values = {
    countryCode: "+963",
    phone: "933 123 456",
    currentPassword: "x",
  };

  it("accepts a number and the current password of a phone account", () => {
    expect(validatePhoneChange(values, true)).toEqual({});
  });

  it("asks phone accounts for the password, Google accounts do not", () => {
    const noPassword = { ...values, currentPassword: "" };
    expect(validatePhoneChange(noPassword, true).currentPassword).toBe(
      "أدخل كلمة المرور.",
    );
    expect(validatePhoneChange(noPassword, false)).toEqual({});
  });

  it("rejects what the registration form rejects", () => {
    for (const bad of ["", "12", "abc", "9".repeat(40)])
      expect(
        validatePhoneChange({ ...values, phone: bad }, false).phone,
        bad,
      ).toBeTruthy();
    expect(validatePhoneChange({ ...values, phone: "" }, false).phone).toBe(
      "أدخل رقم هاتفك.",
    );
  });

  it("sends the same combined number as registration and login", () => {
    expect(newPhone(values)).toBe(combinePhone("+963", "933 123 456"));
    expect(newPhone({ countryCode: "+963", phone: "0933123456" })).toBe(
      "+963933123456",
    );
    expect(newPhone({ countryCode: "+963", phone: "+49 151 2345678" })).toBe(
      "+49 151 2345678",
    );
  });
});

describe("validatePasswordChange (the registration rules, reused)", () => {
  const ok = {
    currentPassword: "Old-pass-1",
    newPassword: "New-pass-2",
    confirmPassword: "New-pass-2",
  };

  it("accepts a valid change", () => {
    expect(validatePasswordChange(ok)).toEqual({});
  });

  it("applies the length, digits, same-password and confirmation rules", () => {
    expect(
      validatePasswordChange({
        ...ok,
        newPassword: "short1",
        confirmPassword: "short1",
      }).newPassword,
    ).toContain("8");
    expect(
      validatePasswordChange({
        ...ok,
        newPassword: "12345678",
        confirmPassword: "12345678",
      }).newPassword,
    ).toBe("يجب ألا تتكون كلمة المرور من أرقام فقط.");
    expect(
      validatePasswordChange({
        ...ok,
        newPassword: ok.currentPassword,
        confirmPassword: ok.currentPassword,
      }).newPassword,
    ).toBe("يجب أن تختلف كلمة المرور الجديدة عن الحالية.");
    expect(
      validatePasswordChange({ ...ok, confirmPassword: "different-1" })
        .confirmPassword,
    ).toBe("كلمتا المرور غير متطابقتين.");
    expect(
      validatePasswordChange({ ...ok, currentPassword: "" }).currentPassword,
    ).toBe("أدخل كلمة المرور.");
    expect(hasErrors(validatePasswordChange({ ...ok, newPassword: "" }))).toBe(
      true,
    );
  });
});

describe("forms are read as typed", () => {
  it("reads strings only", () => {
    const form = new FormData();
    form.set("name", " ليلى ");
    form.set("email", "a@b.co");
    form.set("countryCode", "+963");
    form.set("phone", "933");
    form.set("currentPassword", "p");
    form.set("newPassword", "n");
    expect(readProfileForm(form)).toEqual({ name: " ليلى ", email: "a@b.co" });
    expect(readPhoneForm(form)).toEqual({
      countryCode: "+963",
      phone: "933",
      currentPassword: "p",
    });
    expect(readPasswordForm(form)).toEqual({
      currentPassword: "p",
      newPassword: "n",
      confirmPassword: "",
    });
    form.set("name", new File(["x"], "x.txt"));
    expect(readProfileForm(form).name).toBe("");
  });
});

describe("backend errors → fields", () => {
  it("profile: field marks of a VALIDATION_ERROR, the backend's text otherwise", () => {
    const invalid = failure("VALIDATION_ERROR", [
      { field: "body.email", message: "value is not a valid email address" },
      {
        field: "body.name",
        message: "String should have at least 1 character",
      },
    ]);
    expect(mapProfileError(invalid)).toEqual({
      name: "اكتب اسمك.",
      email: "البريد الإلكتروني غير صحيح.",
    });
    expect(mapProfileError(failure("INTERNAL_ERROR"))).toEqual({ form: msg });
    expect(mapProfileError(new Error("x")).form).toBeTruthy();
  });

  it("phone: the conflict and invalid number on the phone, the password on its field", () => {
    expect(mapPhoneError(failure("PHONE_TAKEN", null, 409))).toEqual({
      phone: msg,
    });
    expect(mapPhoneError(failure("INVALID_PHONE"))).toEqual({ phone: msg });
    expect(mapPhoneError(failure("INVALID_CREDENTIALS", null, 401))).toEqual({
      currentPassword: msg,
    });
    expect(mapPhoneError(failure("CURRENT_PASSWORD_REQUIRED"))).toEqual({
      currentPassword: msg,
    });
    expect(mapPhoneError(failure("SERVICE_BUSY", null, 503))).toEqual({
      form: msg,
    });
  });

  it("password: weak and same on the new password, wrong current on its field", () => {
    expect(mapPasswordError(failure("WEAK_PASSWORD"))).toEqual({
      newPassword: msg,
    });
    expect(mapPasswordError(failure("SAME_PASSWORD"))).toEqual({
      newPassword: msg,
    });
    expect(mapPasswordError(failure("INVALID_CREDENTIALS", null, 401))).toEqual(
      { currentPassword: msg },
    );
    expect(mapPasswordError(failure("NOT_A_PASSWORD_ACCOUNT"))).toEqual({
      form: msg,
    });
  });

  it("a refused password (also a 401) is not a lost session", () => {
    expect(isSessionGone(failure("INVALID_CREDENTIALS", null, 401))).toBe(
      false,
    );
    for (const code of [
      "NOT_AUTHENTICATED",
      "TOKEN_INVALID",
      "TOKEN_EXPIRED",
      "TOKEN_REUSED",
    ])
      expect(isSessionGone(failure(code, null, 401)), code).toBe(true);
    expect(isSessionGone(new Error("x"))).toBe(false);
  });
});
