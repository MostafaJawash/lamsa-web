import { afterEach, describe, expect, it } from "vitest";

import { badgeStore } from "@/features/cart/badge-store";
import { decodeFlash, encodeFlash, flashToast } from "@/features/cart/flash";
import {
  isPreferenceKey,
  PREFERENCE_TEXT,
  preferenceRows,
} from "@/features/notifications/preferences";
import { notificationTarget } from "@/features/notifications/target";
import type { Preferences } from "@/features/notifications/types";
import { getMessages, t } from "@/i18n";
import { pluralize } from "@/lib/format";

describe("preference switches", () => {
  const backend: Preferences = {
    order_updates: true,
    notify_marketing: true,
    notify_favorites: false,
    notify_cart_reminders: true,
  };

  it("one row per switchable key, in the backend's order, never order_updates", () => {
    const rows = preferenceRows(backend);
    expect(rows.map((row) => [row.key, row.enabled])).toEqual([
      ["notify_marketing", true],
      ["notify_favorites", false],
      ["notify_cart_reminders", true],
    ]);
    expect(rows.some((row) => (row.key as string) === "order_updates")).toBe(
      false,
    );
  });

  it("ignores keys this site has no text for", () => {
    const extra = { ...backend, notify_new_thing: true } as Preferences;
    expect(preferenceRows(extra)).toHaveLength(3);
    expect(isPreferenceKey("notify_new_thing")).toBe(false);
    expect(isPreferenceKey("order_updates")).toBe(false);
    expect(isPreferenceKey("toString")).toBe(false);
    expect(isPreferenceKey("notify_marketing")).toBe(true);
  });

  it("labels and hints exist in Arabic, and say what the backend does with the key", () => {
    for (const [key, text] of Object.entries(PREFERENCE_TEXT)) {
      expect(t(text.label), key).toMatch(/[؀-ۿ]/);
      expect(t(text.hint), key).toMatch(/[؀-ۿ]/);
    }
    expect(t(PREFERENCE_TEXT.notify_marketing.hint)).toContain(
      "صندوق الإشعارات",
    );
    expect(t(PREFERENCE_TEXT.notify_favorites.hint)).toContain("المخزون");
    expect(t(PREFERENCE_TEXT.notify_cart_reminders.hint)).toContain("سلتك");
  });
});

describe("where a notification leads", () => {
  const base = { order_id: null };

  it("maps the catalog links like the banners do", () => {
    expect(
      notificationTarget({ ...base, link: { type: "product", value: "a-b" } }),
    ).toEqual({
      kind: "internal",
      href: "/p/a-b",
    });
    expect(
      notificationTarget({ ...base, link: { type: "sale", value: null } }),
    ).toEqual({
      kind: "internal",
      href: "/sale",
    });
    expect(
      notificationTarget({
        ...base,
        link: { type: "url", value: "https://example.com/x" },
      }),
    ).toEqual({ kind: "external", href: "https://example.com/x" });
    expect(
      notificationTarget({
        ...base,
        link: { type: "url", value: "javascript:alert(1)" },
      }),
    ).toEqual({ kind: "none" });
  });

  it("leads to the customer's own order", () => {
    expect(
      notificationTarget({ ...base, link: { type: "order", value: "42" } }),
    ).toEqual({
      kind: "internal",
      href: "/account/orders/42",
    });
    expect(
      notificationTarget({ link: { type: "none", value: null }, order_id: 7 }),
    ).toEqual({
      kind: "internal",
      href: "/account/orders/7",
    });
    for (const value of ["0", "x", "1/../2", "", null])
      expect(
        notificationTarget({ ...base, link: { type: "order", value } }),
      ).toEqual({
        kind: "none",
      });
  });

  it("never leads to an admin screen, and a message without a link is not a link", () => {
    for (const type of ["admin_order", "admin_product"] as const)
      expect(
        notificationTarget({ ...base, link: { type, value: "1" } }),
      ).toEqual({ kind: "none" });
    expect(
      notificationTarget({ ...base, link: { type: "none", value: null } }),
    ).toEqual({
      kind: "none",
    });
  });
});

describe("the unread badge shares the cart and favorites store", () => {
  afterEach(() => badgeStore.reset());

  it("seeds, reads and ignores bad numbers", () => {
    expect(badgeStore.get("notifications")).toBeNull();
    badgeStore.set({ notifications: 3 });
    expect(badgeStore.get("notifications")).toBe(3);
    badgeStore.set({ notifications: -1 });
    badgeStore.set({ notifications: 1.5 });
    expect(badgeStore.get("notifications")).toBe(3);
    badgeStore.set({ cart: 2 });
    expect(badgeStore.get("notifications")).toBe(3);
    expect(badgeStore.get("cart")).toBe(2);
  });

  it("tells its listeners once per change", () => {
    let calls = 0;
    const stop = badgeStore.subscribe(() => (calls += 1));
    badgeStore.set({ notifications: 5 });
    badgeStore.set({ notifications: 5 });
    badgeStore.set({ notifications: 0 });
    stop();
    expect(calls).toBe(2);
  });
});

describe("toasts and counts", () => {
  it("round-trips the new flash kinds and has Arabic toasts for them", () => {
    for (const kind of [
      "profileSaved",
      "phoneChanged",
      "passwordChanged",
      "preferenceSaved",
      "notificationsRead",
    ] as const) {
      const value = encodeFlash({ kind }, "abc12345");
      expect(decodeFlash(value)).toEqual({ id: "abc12345", flash: { kind } });
      expect(flashToast({ kind })?.text, kind).toMatch(/[؀-ۿ]/);
    }
  });

  it("says how many are unread, in every Arabic plural form", () => {
    expect(pluralize(0, "unreadNotifications")).toBe(
      "لا توجد إشعارات غير مقروءة",
    );
    expect(pluralize(1, "unreadNotifications")).toBe("إشعار واحد غير مقروء");
    expect(pluralize(2, "unreadNotifications")).toBe("إشعاران غير مقروءان");
    expect(pluralize(5, "unreadNotifications")).toBe("5 إشعارات غير مقروءة");
    expect(pluralize(12, "unreadNotifications")).toBe("12 إشعارًا غير مقروء");
    expect(pluralize(100, "unreadNotifications")).toBe("100 إشعار غير مقروء");
    expect(Object.keys(getMessages().plurals.unreadNotifications)).toHaveLength(
      6,
    );
  });
});
