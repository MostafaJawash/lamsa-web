/**
 * Backend address errors → what the address form shows. Pure, like auth/errors.ts. The
 * backend's Arabic message wins (INVALID_LOCATION, ADDRESS_LIMIT_REACHED, …); only the
 * per-field marks of a VALIDATION_ERROR use our own texts, because the backend's field
 * messages are English.
 */
import { t } from "@/i18n";
import { ApiError, errorMessage } from "@/lib/errors";

import type { AddressErrors, AddressField } from "./address-validation";

const FIELDS: Record<string, AddressField> = {
  label: "label",
  governorate: "governorate",
  area: "area",
  details: "details",
  notes: "notes",
  latitude: "location",
  longitude: "location",
};

export function mapAddressError(error: unknown): AddressErrors {
  if (!(error instanceof ApiError)) return { form: errorMessage(error) };
  switch (error.code) {
    case "INVALID_LOCATION":
      return { location: errorMessage(error) };
    case "VALIDATION_ERROR": {
      const errors: AddressErrors = {};
      for (const detail of error.validationDetails) {
        const name = detail.field.split(".").pop() ?? "";
        const field = FIELDS[name];
        if (field && !errors[field])
          errors[field] = t("addressForm.errors.invalid");
      }
      return Object.keys(errors).length > 0
        ? errors
        : { form: errorMessage(error) };
    }
    default:
      return { form: errorMessage(error) };
  }
}
