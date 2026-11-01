"use server";

/**
 * account: server actions of /account/settings and the password change page. Each one
 * validates with the same rules the form uses (settings-validation.ts) before calling
 * the backend, then lets the backend decide: its Arabic message is shown for anything it
 * rejects (settings-errors.ts). They work as plain form posts (no JavaScript) and as
 * `useActionState` actions: a failure returns the errors and the typed values (never a
 * password), a success sets a one-shot toast and redirects. Tokens stay on the server;
 * the only cookies written are the session's own (after a password change).
 */
import type { Route } from "next";
import { redirect } from "next/navigation";

import { retryOnceIfBusy } from "@/features/auth/retry";
import { mergeAfterSignIn } from "@/features/cart/merge";
import { setFlash } from "@/features/cart/guest-store";
import { unwrap } from "@/lib/api/client";
import type { Schema } from "@/lib/api/types";
import { withAccess } from "@/lib/auth/action-session";
import { redirectToLogin } from "@/lib/auth/login-redirect";
import { safeNext, withNext } from "@/lib/auth/next-param";
import { ACCOUNT_PATH, CHANGE_PASSWORD_PATH } from "@/lib/auth/paths";
import { setSession } from "@/lib/auth/session";
import { putFailure } from "@/lib/form-failure";

import {
  isSessionGone,
  mapPasswordError,
  mapPhoneError,
  mapProfileError,
} from "./settings-errors";
import {
  hasErrors,
  newPhone,
  readPasswordForm,
  readPhoneForm,
  readProfileForm,
  validatePasswordChange,
  validatePhoneChange,
  validateProfile,
  type SettingsFormState,
} from "./settings-validation";

export type { SettingsFormState } from "./settings-validation";

const SETTINGS_PATH = "/account/settings";

type Failure = NonNullable<SettingsFormState>;

/**
 * A failure is returned to the form (`useActionState`) when JavaScript posted it (`js=1`);
 * a plain form post is sent back to the page with `?fs=` (see lib/form-failure.ts).
 */
function failed(
  form: FormData,
  state: Failure,
  back: string,
): SettingsFormState {
  if (form.get("js") === "1") return state;
  const joiner = back.includes("?") ? "&" : "?";
  return redirect(
    `${back}${joiner}fs=${putFailure(state)}#${state.section}` as Route,
  );
}

function nonEmpty(value: string): string | undefined {
  return value === "" ? undefined : value;
}

/** Name and email. Only what changed is sent, so a Google address the backend would not accept anew stays. */
export async function saveProfile(
  _previous: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const values = readProfileForm(form);
  const errors = validateProfile(values);
  const state = (e: Failure["errors"]): Failure => ({
    section: "profile",
    errors: e,
    values,
  });
  if (hasErrors(errors)) return failed(form, state(errors), SETTINGS_PATH);

  const name = values.name.trim();
  const email = values.email.trim();
  try {
    await withAccess(async (api) => {
      const me = await unwrap(api.GET("/users/me"));
      const body: { name?: string; email?: string | null } = {};
      if (name !== me.name) body.name = name;
      if (email !== (me.email ?? "")) body.email = nonEmpty(email) ?? null;
      if (Object.keys(body).length > 0)
        await unwrap(api.PATCH("/users/me", { body }));
    });
  } catch (error) {
    if (isSessionGone(error)) redirectToLogin(SETTINGS_PATH);
    return failed(form, state(mapProfileError(error)), SETTINGS_PATH);
  }
  await setFlash({ kind: "profileSaved" });
  redirect(SETTINGS_PATH as Route);
}

/**
 * The login phone. The backend asks phone accounts for the current password (Google
 * accounts have none); it changes nothing else (no SMS, no code, the sessions stay).
 */
export async function changePhone(
  _previous: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const values = readPhoneForm(form);
  const shown = { countryCode: values.countryCode, phone: values.phone };
  const state = (e: Failure["errors"]): Failure => ({
    section: "phone",
    errors: e,
    values: shown,
  });
  let needsPassword = true;
  try {
    const me = await withAccess((api) => unwrap(api.GET("/users/me")));
    needsPassword = me.auth_provider === "phone";
  } catch (error) {
    if (isSessionGone(error)) redirectToLogin(SETTINGS_PATH);
    return failed(form, state(mapPhoneError(error)), SETTINGS_PATH);
  }
  const errors = validatePhoneChange(values, needsPassword);
  if (hasErrors(errors)) return failed(form, state(errors), SETTINGS_PATH);

  try {
    await withAccess((api) =>
      retryOnceIfBusy(() =>
        unwrap(
          api.POST("/users/me/phone", {
            body: {
              phone: newPhone(values),
              ...(needsPassword
                ? { current_password: values.currentPassword }
                : {}),
            },
          }),
        ),
      ),
    );
  } catch (error) {
    if (isSessionGone(error)) redirectToLogin(SETTINGS_PATH);
    return failed(form, state(mapPhoneError(error)), SETTINGS_PATH);
  }
  await setFlash({ kind: "phoneChanged" });
  redirect(SETTINGS_PATH as Route);
}

/**
 * The password of a phone account, from /account/settings or from the forced page
 * (`return_to=gate`, with the `next` it was reached with). The backend ends every other
 * session and answers with a fresh pair for this one: it replaces the cookies here.
 * After a forced change the visitor continues where the gate interrupted them.
 */
export async function changeAccountPassword(
  _previous: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const values = readPasswordForm(form);
  const gate = form.get("return_to") === "gate";
  const next = form.get("next");
  const back = gate ? withNext(CHANGE_PASSWORD_PATH, next) : SETTINGS_PATH;
  const state = (e: Failure["errors"]): Failure => ({
    section: "password",
    errors: e,
    values: {},
  });
  const errors = validatePasswordChange(values);
  if (hasErrors(errors)) return failed(form, state(errors), back);

  let pair: Schema<"TokenPair">;
  try {
    pair = await withAccess((api) =>
      retryOnceIfBusy(() =>
        unwrap(
          api.POST("/auth/password/change", {
            body: {
              current_password: values.currentPassword,
              new_password: values.newPassword,
            },
          }),
        ),
      ),
    );
  } catch (error) {
    if (isSessionGone(error))
      redirectToLogin(gate ? CHANGE_PASSWORD_PATH : SETTINGS_PATH);
    return failed(form, state(mapPasswordError(error)), back);
  }
  await setSession(pair);
  await mergeAfterSignIn(pair.access_token);
  await setFlash({ kind: "passwordChanged" });
  if (gate) {
    const target = safeNext(next);
    redirect((target === "/" ? ACCOUNT_PATH : target) as Route);
  }
  redirect(SETTINGS_PATH as Route);
}
