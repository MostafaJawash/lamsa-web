/**
 * The notification preferences the backend exposes (`PATCH /users/me/notification-preferences`):
 * one switch per key, labelled by what that key really controls in the backend.
 *
 * - `notify_marketing`: promotional campaigns the store sends to everyone. While it is off
 *   the backend also hides them from the inbox.
 * - `notify_favorites`: back-in-stock and price-drop alerts for products in the favorites.
 * - `notify_cart_reminders`: the reminder about a cart left without an order.
 *
 * `order_updates` is always on (order status messages cannot be switched off) and so are
 * the store's direct messages: no switch for either, only a note.
 */
import type { MessageKey } from "@/i18n";

import type { Preferences, PreferencesUpdate } from "./types";

export type PreferenceKey = keyof PreferencesUpdate;

type PreferenceText = { label: MessageKey; hint: MessageKey };

/** Every updatable key has its text (the compiler checks it against the generated schema). */
export const PREFERENCE_TEXT = {
  notify_marketing: {
    label: "notifications.preferences.marketing.label",
    hint: "notifications.preferences.marketing.hint",
  },
  notify_favorites: {
    label: "notifications.preferences.favorites.label",
    hint: "notifications.preferences.favorites.hint",
  },
  notify_cart_reminders: {
    label: "notifications.preferences.cartReminders.label",
    hint: "notifications.preferences.cartReminders.hint",
  },
} as const satisfies Record<PreferenceKey, PreferenceText>;

export function isPreferenceKey(value: unknown): value is PreferenceKey {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PREFERENCE_TEXT, value)
  );
}

export type PreferenceRow = {
  key: PreferenceKey;
  enabled: boolean;
  label: MessageKey;
  hint: MessageKey;
};

/**
 * One row per switchable key the backend returned, in its order. `order_updates` (always
 * on) and any key this site has no text for are not rows.
 */
export function preferenceRows(preferences: Preferences): PreferenceRow[] {
  const rows: PreferenceRow[] = [];
  for (const [key, value] of Object.entries(preferences)) {
    if (isPreferenceKey(key) && typeof value === "boolean")
      rows.push({ key, enabled: value, ...PREFERENCE_TEXT[key] });
  }
  return rows;
}
