import { describe, expect, it } from "vitest";

import { mapAddressError } from "@/features/account/address-errors";
import {
  ADDRESS_LIMITS,
  emptyAddress,
  hasErrors,
  parseLocation,
  readAddressForm,
  textLength,
  validateAddress,
  type AddressValues,
} from "@/features/account/address-validation";
import { ApiError } from "@/lib/errors";

const CODES = ["damascus", "aleppo"];
const valid: AddressValues = {
  ...emptyAddress,
  governorate: "damascus",
  details: "شارع الجلاء، بناء 12، الطابق 3",
};

describe("validateAddress (mirrors the backend limits)", () => {
  it("accepts a minimal address: governorate and details only", () => {
    expect(validateAddress(valid, CODES)).toEqual({});
  });

  it("requires a known governorate", () => {
    expect(
      validateAddress({ ...valid, governorate: "" }, CODES).governorate,
    ).toBeTruthy();
    expect(
      validateAddress({ ...valid, governorate: "berlin" }, CODES).governorate,
    ).toBeTruthy();
    // Without the list there is no membership check (the backend decides).
    expect(
      validateAddress({ ...valid, governorate: "berlin" }).governorate,
    ).toBeUndefined();
  });

  it("requires details of 10 to 500 characters", () => {
    expect(validateAddress({ ...valid, details: "" }).details).toBeTruthy();
    expect(validateAddress({ ...valid, details: "قصير" }).details).toBeTruthy();
    expect(
      validateAddress({ ...valid, details: "ا".repeat(9) }).details,
    ).toBeTruthy();
    expect(
      validateAddress({ ...valid, details: "ا".repeat(10) }).details,
    ).toBeUndefined();
    expect(
      validateAddress({ ...valid, details: "ا".repeat(500) }).details,
    ).toBeUndefined();
    expect(
      validateAddress({ ...valid, details: "ا".repeat(501) }).details,
    ).toBeTruthy();
  });

  it("counts like the backend: trimmed, in code points", () => {
    expect(textLength("  ab  ")).toBe(2);
    expect(textLength("😀😀")).toBe(2);
    expect(
      validateAddress({ ...valid, details: `   ${"ا".repeat(9)}   ` }).details,
    ).toBeTruthy();
    expect(
      validateAddress({ ...valid, details: "😀".repeat(10) }).details,
    ).toBeUndefined();
  });

  it("bounds the optional fields", () => {
    expect(
      validateAddress({ ...valid, label: "ب".repeat(ADDRESS_LIMITS.label) })
        .label,
    ).toBeUndefined();
    expect(
      validateAddress({ ...valid, label: "ب".repeat(ADDRESS_LIMITS.label + 1) })
        .label,
    ).toBeTruthy();
    expect(
      validateAddress({ ...valid, area: "م".repeat(101) }).area,
    ).toBeTruthy();
    expect(
      validateAddress({ ...valid, notes: "ن".repeat(501) }).notes,
    ).toBeTruthy();
  });

  it("treats the map location as optional, but a pair inside Syria", () => {
    expect(
      validateAddress({ ...valid, latitude: "33.5138", longitude: "36.2765" })
        .location,
    ).toBeUndefined();
    expect(
      validateAddress({ ...valid, latitude: "33.5138" }).location,
    ).toBeTruthy();
    expect(
      validateAddress({ ...valid, longitude: "36.2765" }).location,
    ).toBeTruthy();
    expect(
      validateAddress({ ...valid, latitude: "52.52", longitude: "13.405" })
        .location,
    ).toBeTruthy();
    expect(
      validateAddress({ ...valid, latitude: "abc", longitude: "36" }).location,
    ).toBeTruthy();
  });

  it("reports whether anything is wrong", () => {
    expect(hasErrors(validateAddress(valid))).toBe(false);
    expect(hasErrors(validateAddress(emptyAddress))).toBe(true);
  });
});

describe("address form helpers", () => {
  it("reads the form fields and trims the governorate and coordinates", () => {
    const form = new FormData();
    form.set("governorate", " aleppo ");
    form.set("details", "حي الفرقان");
    form.set("latitude", " 36.2 ");
    form.set("longitude", "37.1");
    expect(readAddressForm(form)).toMatchObject({
      governorate: "aleppo",
      details: "حي الفرقان",
      latitude: "36.2",
      longitude: "37.1",
      label: "",
    });
  });

  it("parses a location only when both coordinates are numbers", () => {
    expect(parseLocation({ latitude: "33.5", longitude: "36.2" })).toEqual({
      lat: 33.5,
      lng: 36.2,
    });
    expect(parseLocation({ latitude: "", longitude: "36.2" })).toBeNull();
    expect(parseLocation({ latitude: "x", longitude: "36.2" })).toBeNull();
  });
});

describe("mapAddressError (backend errors on the address form)", () => {
  it("shows the backend's own message for the location and the address limit", () => {
    const location = new ApiError(
      422,
      "INVALID_LOCATION",
      "رسالة الخادم عن الموقع",
    );
    expect(mapAddressError(location)).toEqual({
      location: "رسالة الخادم عن الموقع",
    });
    const limit = new ApiError(
      422,
      "ADDRESS_LIMIT_REACHED",
      "وصلت إلى الحد الأقصى من العناوين (10).",
    );
    expect(mapAddressError(limit)).toEqual({
      form: "وصلت إلى الحد الأقصى من العناوين (10).",
    });
  });

  it("marks the fields of a validation error", () => {
    const error = new ApiError(
      422,
      "VALIDATION_ERROR",
      "بعض البيانات غير صحيحة.",
      [
        {
          field: "details",
          message: "String should have at least 10 characters",
        },
        { field: "governorate", message: "unsupported governorate" },
      ],
    );
    const errors = mapAddressError(error);
    expect(Object.keys(errors).sort()).toEqual(["details", "governorate"]);
  });

  it("falls back to a form message for anything else", () => {
    expect(
      mapAddressError(new ApiError(0, "NETWORK_ERROR", null)).form,
    ).toBeTruthy();
    expect(mapAddressError(new Error("boom")).form).toBeTruthy();
  });
});
