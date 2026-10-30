/**
 * Address rules, mirroring the backend's `AddressCreate` (label up to 50, governorate
 * required, area up to 100, details 10..500, notes up to 500, optional coordinates that
 * come as a pair inside Syria). Pure: the form validates with it for instant feedback and
 * the server actions run the same check again before calling the backend, which stays the
 * judge (its own message wins when it rejects something).
 */
import { isWithinSyria } from "@/config/governorates";
import { t } from "@/i18n";

export const ADDRESS_LIMITS = {
  label: 50,
  area: 100,
  detailsMin: 10,
  detailsMax: 500,
  notes: 500,
} as const;

export type AddressField =
  "label" | "governorate" | "area" | "details" | "notes" | "location" | "form";

export type AddressErrors = Partial<Record<AddressField, string>>;

/** What the form holds: every field as the text typed (coordinates as decimal text). */
export type AddressValues = {
  label: string;
  governorate: string;
  area: string;
  details: string;
  notes: string;
  latitude: string;
  longitude: string;
};

export const emptyAddress: AddressValues = {
  label: "",
  governorate: "",
  area: "",
  details: "",
  notes: "",
  latitude: "",
  longitude: "",
};

/** Characters as the backend counts them (code points, after trimming). */
export function textLength(value: string): number {
  return [...value.trim()].length;
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export function readAddressForm(form: FormData): AddressValues {
  return {
    label: text(form, "label"),
    governorate: text(form, "governorate").trim(),
    area: text(form, "area"),
    details: text(form, "details"),
    notes: text(form, "notes"),
    latitude: text(form, "latitude").trim(),
    longitude: text(form, "longitude").trim(),
  };
}

/** The coordinate pair as numbers, or null when none is set (or only half of it). */
export function parseLocation(
  values: Pick<AddressValues, "latitude" | "longitude">,
): { lat: number; lng: number } | null {
  if (!values.latitude || !values.longitude) return null;
  const lat = Number(values.latitude);
  const lng = Number(values.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/**
 * Field errors in Arabic, `{}` when valid. `governorates`: the codes the backend lists
 * (omit to skip the membership check). The location is optional, but when present it
 * must be a complete pair inside Syria's bounding box.
 */
export function validateAddress(
  values: AddressValues,
  governorates?: readonly string[],
): AddressErrors {
  const errors: AddressErrors = {};
  if (textLength(values.label) > ADDRESS_LIMITS.label)
    errors.label = t("addressForm.errors.labelLong", {
      max: ADDRESS_LIMITS.label,
    });
  if (!values.governorate)
    errors.governorate = t("addressForm.errors.governorateRequired");
  else if (governorates && !governorates.includes(values.governorate))
    errors.governorate = t("addressForm.errors.governorateUnknown");
  if (textLength(values.area) > ADDRESS_LIMITS.area)
    errors.area = t("addressForm.errors.areaLong", {
      max: ADDRESS_LIMITS.area,
    });
  const details = textLength(values.details);
  if (details === 0) errors.details = t("addressForm.errors.detailsRequired");
  else if (details < ADDRESS_LIMITS.detailsMin)
    errors.details = t("addressForm.errors.detailsShort", {
      min: ADDRESS_LIMITS.detailsMin,
    });
  else if (details > ADDRESS_LIMITS.detailsMax)
    errors.details = t("addressForm.errors.detailsLong", {
      max: ADDRESS_LIMITS.detailsMax,
    });
  if (textLength(values.notes) > ADDRESS_LIMITS.notes)
    errors.notes = t("addressForm.errors.notesLong", {
      max: ADDRESS_LIMITS.notes,
    });
  const hasLat = values.latitude !== "";
  const hasLng = values.longitude !== "";
  if (hasLat || hasLng) {
    const point = parseLocation(values);
    if (!point || !isWithinSyria(point.lat, point.lng))
      errors.location = t("addressForm.errors.locationInvalid");
  }
  return errors;
}

export function hasErrors(errors: AddressErrors): boolean {
  return Object.keys(errors).length > 0;
}
