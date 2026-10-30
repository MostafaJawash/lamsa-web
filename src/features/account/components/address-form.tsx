"use client";

import type { Route } from "next";
import Link from "next/link";
import { useActionState, useId, useState, useSyncExternalStore } from "react";

import { formatCoordinate, type LatLng } from "@/config/governorates";
import { t } from "@/i18n";

import type { AddressFormState } from "../actions";
import {
  ADDRESS_LIMITS,
  emptyAddress,
  hasErrors,
  textLength,
  validateAddress,
  type AddressErrors,
  type AddressField,
  type AddressValues,
} from "../address-validation";
import type { Governorate } from "../types";
import { LocationPicker } from "./location-picker";

type Props = {
  /** `saveAddress`; the form posts to it with or without JavaScript. */
  action: (
    previous: AddressFormState,
    form: FormData,
  ) => Promise<AddressFormState>;
  governorates: readonly Governorate[];
  /** Values to start from (an address being edited, or defaults). */
  initial?: Partial<AddressValues>;
  /** The failure of a plain form post, handed back by the server (no JavaScript). */
  initialState?: AddressFormState;
  /** The address being edited; omitted when creating. */
  addressId?: number;
  /** Where the action sends the customer afterwards. */
  returnTo: "addresses" | "checkout";
  /** Show "تعيين كعنوان افتراضي" (not for the first address, which is always the default). */
  offerDefault?: boolean;
  submitLabel?: string;
  cancelHref?: Route;
};

const FIELD_ORDER: AddressField[] = [
  "label",
  "governorate",
  "area",
  "details",
  "notes",
  "location",
];

/**
 * The shared address form (checkout and /account/addresses): label, governorate (from the
 * backend's list), area, details with a live counter, notes and the optional map location.
 * Limits mirror the backend (address-validation.ts) for instant feedback while typing; the
 * server action checks them again, and the backend's own message is shown for anything it
 * rejects. A plain form post works without JavaScript (the map is the only part that
 * needs it).
 */
export function AddressForm({
  action,
  governorates,
  initial,
  initialState = null,
  addressId,
  returnTo,
  offerDefault = false,
  submitLabel,
  cancelHref,
}: Props) {
  const base = useId();
  const [state, formAction, pending] = useActionState(action, initialState);
  // Set once JavaScript runs: the action then returns its failure instead of redirecting.
  const scripted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [values, setValues] = useState<AddressValues>(() => ({
    ...emptyAddress,
    ...initial,
    ...state?.values,
  }));
  // Server errors stay until the customer edits that field; typing shows the live rules.
  const [seen, setSeen] = useState(state);
  const [edited, setEdited] = useState<ReadonlySet<AddressField>>(new Set());
  const [touched, setTouched] = useState<ReadonlySet<AddressField>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  if (state !== seen) {
    setSeen(state);
    setEdited(new Set());
  }

  const live = validateAddress(
    values,
    governorates.map((item) => item.code),
  );
  const errors: AddressErrors = {};
  for (const field of [...FIELD_ORDER, "form" as const]) {
    const fromServer =
      state && !edited.has(field) ? state.errors[field] : undefined;
    const fromRules =
      (submitted || touched.has(field)) && field !== "form"
        ? live[field]
        : undefined;
    errors[field] = fromServer ?? fromRules;
  }

  const ids = (name: string) => ({
    input: `${base}-${name}`,
    error: `${base}-${name}-err`,
  });
  const set = (field: keyof AddressValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    const key: AddressField =
      field === "latitude" || field === "longitude" ? "location" : field;
    setEdited((current) => new Set(current).add(key));
  };
  const touch = (field: AddressField) =>
    setTouched((current) => new Set(current).add(field));
  const setPoint = (point: LatLng | null) => {
    setValues((current) => ({
      ...current,
      latitude: point ? formatCoordinate(point.lat) : "",
      longitude: point ? formatCoordinate(point.lng) : "",
    }));
    setEdited((current) => new Set(current).add("location"));
  };

  const describe = (field: AddressField, ...extra: string[]) =>
    [errors[field] ? ids(field).error : null, ...extra]
      .filter(Boolean)
      .join(" ") || undefined;

  const detailsCount = textLength(values.details);

  return (
    <form
      action={formAction}
      noValidate
      className="lm-addr-form"
      data-address-form
      onSubmit={(event) => {
        setSubmitted(true);
        const found = validateAddress(
          values,
          governorates.map((item) => item.code),
        );
        if (hasErrors(found)) {
          event.preventDefault();
          const first = FIELD_ORDER.find((field) => found[field]);
          const target = first
            ? event.currentTarget.querySelector<HTMLElement>(
                `[data-field="${first}"]`,
              )
            : null;
          target?.focus();
        }
      }}
    >
      {scripted ? <input type="hidden" name="js" value="1" /> : null}
      {addressId ? <input type="hidden" name="id" value={addressId} /> : null}
      <input type="hidden" name="return_to" value={returnTo} />

      <div className="lm-fld">
        <label htmlFor={ids("label").input}>{t("addressForm.label")}</label>
        <input
          id={ids("label").input}
          data-field="label"
          className="lm-inp"
          name="label"
          value={values.label}
          maxLength={ADDRESS_LIMITS.label}
          placeholder={t("addressForm.labelPlaceholder")}
          aria-invalid={errors.label ? true : undefined}
          aria-describedby={describe("label")}
          onChange={(event) => set("label", event.target.value)}
          onBlur={() => touch("label")}
        />
        {errors.label ? (
          <p
            id={ids("label").error}
            className="lm-err"
            data-field-error="label"
          >
            {errors.label}
          </p>
        ) : null}
      </div>

      <div className="lm-fld">
        <label htmlFor={ids("governorate").input}>
          {t("addressForm.governorate")}
        </label>
        <select
          id={ids("governorate").input}
          data-field="governorate"
          className="lm-inp"
          name="governorate"
          required
          value={values.governorate}
          aria-invalid={errors.governorate ? true : undefined}
          aria-describedby={describe("governorate")}
          onChange={(event) => set("governorate", event.target.value)}
          onBlur={() => touch("governorate")}
        >
          <option value="">{t("addressForm.governoratePlaceholder")}</option>
          {governorates.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
        {errors.governorate ? (
          <p
            id={ids("governorate").error}
            className="lm-err"
            data-field-error="governorate"
          >
            {errors.governorate}
          </p>
        ) : null}
      </div>

      <div className="lm-fld">
        <label htmlFor={ids("area").input}>{t("addressForm.area")}</label>
        <input
          id={ids("area").input}
          data-field="area"
          className="lm-inp"
          name="area"
          value={values.area}
          maxLength={ADDRESS_LIMITS.area}
          aria-invalid={errors.area ? true : undefined}
          aria-describedby={describe("area")}
          onChange={(event) => set("area", event.target.value)}
          onBlur={() => touch("area")}
        />
        {errors.area ? (
          <p id={ids("area").error} className="lm-err" data-field-error="area">
            {errors.area}
          </p>
        ) : null}
      </div>

      <div className="lm-fld">
        <label htmlFor={ids("details").input}>{t("addressForm.details")}</label>
        <textarea
          id={ids("details").input}
          data-field="details"
          className="lm-inp lm-textarea"
          name="details"
          required
          rows={3}
          value={values.details}
          maxLength={ADDRESS_LIMITS.detailsMax}
          placeholder={t("addressForm.detailsPlaceholder")}
          aria-invalid={errors.details ? true : undefined}
          aria-describedby={describe(
            "details",
            `${ids("details").input}-count`,
          )}
          onChange={(event) => set("details", event.target.value)}
          onBlur={() => touch("details")}
        />
        <div className="lm-counter-row">
          {errors.details ? (
            <p
              id={ids("details").error}
              className="lm-err"
              data-field-error="details"
            >
              {errors.details}
            </p>
          ) : (
            <span className="lm-hint">{t("addressForm.detailsHint")}</span>
          )}
          <span
            id={`${ids("details").input}-count`}
            className="lm-hint lm-num"
            dir="ltr"
            data-testid="details-count"
          >
            {t("addressForm.counter", {
              n: detailsCount,
              max: ADDRESS_LIMITS.detailsMax,
            })}
          </span>
        </div>
      </div>

      <div className="lm-fld">
        <label htmlFor={ids("notes").input}>{t("addressForm.notes")}</label>
        <input
          id={ids("notes").input}
          data-field="notes"
          className="lm-inp"
          name="notes"
          value={values.notes}
          maxLength={ADDRESS_LIMITS.notes}
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={describe("notes")}
          onChange={(event) => set("notes", event.target.value)}
          onBlur={() => touch("notes")}
        />
        {errors.notes ? (
          <p
            id={ids("notes").error}
            className="lm-err"
            data-field-error="notes"
          >
            {errors.notes}
          </p>
        ) : null}
      </div>

      <LocationPicker
        governorate={values.governorate}
        latitude={values.latitude}
        longitude={values.longitude}
        onChange={setPoint}
        error={errors.location}
      />

      {offerDefault ? (
        <label className="lm-check-row">
          <input type="checkbox" name="is_default" />
          <span>{t("addressForm.makeDefault")}</span>
        </label>
      ) : null}

      {errors.form ? (
        <p className="lm-err" role="alert" data-field-error="form">
          {errors.form}
        </p>
      ) : null}

      <div className="lm-addr-actions">
        <button
          type="submit"
          className="lm-btn primary sm"
          disabled={pending}
          aria-busy={pending}
        >
          {pending
            ? t("addressForm.saving")
            : (submitLabel ?? t("addressForm.save"))}
        </button>
        {cancelHref ? (
          <Link href={cancelHref} className="lm-btn ghost sm">
            {t("addressForm.cancel")}
          </Link>
        ) : null}
      </div>
    </form>
  );
}
