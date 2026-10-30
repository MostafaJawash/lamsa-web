"use server";

/**
 * account: server actions for addresses. Each one validates with the same rules the form
 * uses (address-validation.ts) before calling the backend, then lets the backend decide:
 * its Arabic message is shown for anything it rejects (address-errors.ts). They work as
 * plain form posts (no JavaScript) and as `useActionState` actions: a failure returns the
 * errors and the typed values, a success sets a one-shot toast and redirects.
 */
import type { Route } from "next";
import { redirect } from "next/navigation";

import { setFlash } from "@/features/cart/guest-store";
import { unwrap } from "@/lib/api/client";
import { withAccess } from "@/lib/auth/action-session";
import { isUnauthenticated, redirectToLogin } from "@/lib/auth/login-redirect";
import { ApiError } from "@/lib/errors";
import { putFailure } from "@/lib/form-failure";

import { mapAddressError } from "./address-errors";
import {
  hasErrors,
  readAddressForm,
  validateAddress,
  type AddressErrors,
  type AddressValues,
} from "./address-validation";
import { getGovernorates } from "./queries";

export type AddressFormState = {
  errors: AddressErrors;
  values: AddressValues;
} | null;

const ADDRESSES_PATH = "/account/addresses";

function positiveInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}

/** Where an address form returns to: only these two places, never a URL from the form. */
function destination(form: FormData, addressId: number): Route {
  return (
    form.get("return_to") === "checkout"
      ? `/checkout?address=${addressId}`
      : ADDRESSES_PATH
  ) as Route;
}

/**
 * A failure is returned to the form (`useActionState`) when JavaScript posted it (`js=1`);
 * a plain form post is sent back to the form with `?fs=` (see lib/form-failure.ts).
 */
function failed(
  form: FormData,
  state: NonNullable<AddressFormState>,
  id: number | null,
): AddressFormState {
  if (form.get("js") === "1") return state;
  const base =
    form.get("return_to") === "checkout"
      ? "/checkout?new=1"
      : id
        ? `${ADDRESSES_PATH}?edit=${id}`
        : `${ADDRESSES_PATH}?new=1`;
  return redirect(`${base}&fs=${putFailure(state)}` as Route);
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Creates an address, or updates it when the form carries its `id` (`PATCH` with every
 * field, so a blank area, notes or removed map pin clears the stored value). The same
 * action serves /account/addresses and the inline form in checkout (`return_to`).
 */
export async function saveAddress(
  _previous: AddressFormState,
  form: FormData,
): Promise<AddressFormState> {
  const values = readAddressForm(form);
  const id = positiveInt(form.get("id"));
  const governorates = await getGovernorates();
  const errors = validateAddress(
    values,
    governorates.status === "ok"
      ? governorates.data.map((item) => item.code)
      : undefined,
  );
  if (hasErrors(errors)) return failed(form, { errors, values }, id);

  const body = {
    label: nullIfBlank(values.label),
    governorate: values.governorate,
    area: nullIfBlank(values.area),
    details: values.details.trim(),
    notes: nullIfBlank(values.notes),
    latitude: nullIfBlank(values.latitude),
    longitude: nullIfBlank(values.longitude),
  };
  const makeDefault = form.get("is_default") === "on";
  let savedId: number;
  try {
    const saved = await withAccess((api) =>
      id === null
        ? unwrap(
            api.POST("/users/me/addresses", {
              body: { ...body, is_default: makeDefault },
            }),
          )
        : unwrap(
            api.PATCH("/users/me/addresses/{address_id}", {
              params: { path: { address_id: id } },
              body: makeDefault ? { ...body, is_default: true } : body,
            }),
          ),
    );
    savedId = saved.id;
  } catch (error) {
    if (isUnauthenticated(error)) redirectToLogin(ADDRESSES_PATH);
    return failed(form, { errors: mapAddressError(error), values }, id);
  }
  await setFlash({ kind: "addressSaved" });
  redirect(destination(form, savedId));
}

/** Runs a one-click address change, then back to the list with a toast (or the error). */
async function change(
  form: FormData,
  run: (id: number) => Promise<unknown>,
  success: "addressDeleted" | "addressDefault",
): Promise<never> {
  const id = positiveInt(form.get("id"));
  try {
    if (id === null) throw new Error("bad address id");
    await run(id);
    await setFlash({ kind: success });
  } catch (error) {
    if (isUnauthenticated(error)) redirectToLogin(ADDRESSES_PATH);
    // The toast shows the backend's message for its code (ADDRESS_NOT_FOUND, …).
    const code =
      error instanceof ApiError && /^[A-Z][A-Z_]{1,40}$/.test(error.code)
        ? error.code
        : "ADDRESS_NOT_FOUND";
    await setFlash({ kind: "error", code, n: null });
  }
  redirect(ADDRESSES_PATH as Route);
}

/** "حذف" after the confirmation. The backend gives the default to the newest address. */
export async function deleteAddress(form: FormData): Promise<void> {
  await change(
    form,
    (id) =>
      withAccess((api) =>
        unwrap(
          api.DELETE("/users/me/addresses/{address_id}", {
            params: { path: { address_id: id } },
          }),
        ),
      ),
    "addressDeleted",
  );
}

/** "تعيين كافتراضي". */
export async function setDefaultAddress(form: FormData): Promise<void> {
  await change(
    form,
    (id) =>
      withAccess((api) =>
        unwrap(
          api.POST("/users/me/addresses/{address_id}/default", {
            params: { path: { address_id: id } },
          }),
        ),
      ),
    "addressDefault",
  );
}
