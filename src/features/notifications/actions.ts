"use server";

/**
 * notifications: server actions. The inbox actions are plain form posts (they work
 * without JavaScript): open a notification (marks it read, then goes where it leads),
 * mark one read, mark all read. A preference switch posts like a `useActionState` action
 * with JavaScript (instant, rolled back on failure) and as a plain form without it.
 * The backend scopes everything to the signed-in customer: someone else's notification
 * id is NOTIFICATION_NOT_FOUND. Where a notification leads is looked up from the
 * backend's own list, never taken from the form.
 */
import type { Route } from "next";
import { redirect } from "next/navigation";

import { setFlash } from "@/features/cart/guest-store";
import { unwrap } from "@/lib/api/client";
import { withAccess } from "@/lib/auth/action-session";
import { redirectToLogin } from "@/lib/auth/login-redirect";
import { ApiError, errorMessage } from "@/lib/errors";

import { isSessionGone } from "@/features/account/settings-errors";
import { isPreferenceKey, type PreferenceKey } from "./preferences";
import { NOTIFICATIONS_PAGE_SIZE } from "./queries";
import { notificationTarget } from "./target";

const INBOX_PATH = "/account/notifications";
const SETTINGS_PATH = "/account/settings";

/** What a preference switch gets back (never anything but its own key and value). */
export type PreferenceState = {
  key: PreferenceKey;
  enabled: boolean;
  error: string | null;
};

function positiveInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}

/** The inbox page a form came from (`page`), so the redirect lands on it again. */
function inboxHref(form: FormData): Route {
  const page = positiveInt(form.get("page"));
  return (
    page && page > 1 ? `${INBOX_PATH}?page=${page}` : INBOX_PATH
  ) as Route;
}

/** The toast for a failed one-click change: the backend's own text for its code. */
async function flashFailure(error: unknown, fallback: string): Promise<void> {
  const code =
    error instanceof ApiError && /^[A-Z][A-Z_]{1,40}$/.test(error.code)
      ? error.code
      : fallback;
  await setFlash({ kind: "error", code, n: null });
}

/**
 * Clicking a notification: marks it read, then goes to what it is about (the order, the
 * product, ...). One without a target, or one that vanished, just stays in the list.
 */
export async function openNotification(form: FormData): Promise<void> {
  const id = positiveInt(form.get("id"));
  const back = inboxHref(form);
  let destination: Route | string = back;
  try {
    if (id === null) throw new ApiError(404, "NOTIFICATION_NOT_FOUND", null);
    const page = positiveInt(form.get("page")) ?? 1;
    await withAccess(async (api) => {
      const inbox = await unwrap(
        api.GET("/notifications", {
          params: { query: { page, page_size: NOTIFICATIONS_PAGE_SIZE } },
        }),
      );
      await unwrap(
        api.POST("/notifications/{notification_id}/read", {
          params: { path: { notification_id: id } },
        }),
      );
      const found = inbox.items.find((item) => item.id === id);
      const target = found ? notificationTarget(found) : null;
      if (target && target.kind !== "none") destination = target.href;
    });
  } catch (error) {
    if (isSessionGone(error)) redirectToLogin(INBOX_PATH);
    await flashFailure(error, "NOTIFICATION_NOT_FOUND");
    destination = back;
  }
  redirect(destination as Route);
}

/** "تعليم كمقروء" on one notification. */
export async function markNotificationRead(form: FormData): Promise<void> {
  const id = positiveInt(form.get("id"));
  try {
    if (id === null) throw new ApiError(404, "NOTIFICATION_NOT_FOUND", null);
    await withAccess((api) =>
      unwrap(
        api.POST("/notifications/{notification_id}/read", {
          params: { path: { notification_id: id } },
        }),
      ),
    );
  } catch (error) {
    if (isSessionGone(error)) redirectToLogin(INBOX_PATH);
    await flashFailure(error, "NOTIFICATION_NOT_FOUND");
  }
  redirect(inboxHref(form));
}

/** "تعليم الكل كمقروء": the customer's whole inbox (broadcasts count once, for them). */
export async function markAllNotificationsRead(form: FormData): Promise<void> {
  try {
    await withAccess((api) => unwrap(api.POST("/notifications/read-all")));
    await setFlash({ kind: "notificationsRead" });
  } catch (error) {
    if (isSessionGone(error)) redirectToLogin(INBOX_PATH);
    await flashFailure(error, "INTERNAL_ERROR");
  }
  redirect(inboxHref(form));
}

/**
 * One preference switch: `key` and, when the box is ticked, `enabled`. With JavaScript
 * (`js=1`, called straight from the switch) the new state, or the old one and the error,
 * is returned; as a plain form post it returns to the settings page with a toast.
 */
export async function setPreference(
  _previous: PreferenceState | null,
  form: FormData,
): Promise<PreferenceState> {
  const key = form.get("key");
  if (!isPreferenceKey(key)) throw new Error("bad preference key");
  const enabled = form.has("enabled");
  const scripted = form.get("js") === "1";
  let saved: boolean;
  try {
    saved = (
      await withAccess((api) =>
        unwrap(
          api.PATCH("/users/me/notification-preferences", {
            body: { [key]: enabled },
          }),
        ),
      )
    )[key];
  } catch (error) {
    if (isSessionGone(error)) redirectToLogin(SETTINGS_PATH);
    if (scripted)
      // Back to what it was: the client rolls the switch back to this value.
      return { key, enabled: !enabled, error: errorMessage(error) };
    await flashFailure(error, "INTERNAL_ERROR");
    redirect(`${SETTINGS_PATH}#notifications` as Route);
  }
  if (scripted) return { key, enabled: saved, error: null };
  await setFlash({ kind: "preferenceSaved" });
  redirect(`${SETTINGS_PATH}#notifications` as Route);
}
