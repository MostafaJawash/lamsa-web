/**
 * notifications: server-side reads.
 * Backend: GET /notifications?page=&page_size= (newest first, with the unread count),
 * GET /users/me/notification-preferences
 *
 * Personal and always fresh: read per request with the visitor's token, never cached.
 * The inbox is the customer's own notifications and the store's broadcasts; the backend
 * decides what is in it. Server-only.
 */
import "server-only";

import { getApi, pageTimeout, unwrap } from "@/lib/api/client";
import { logQueryFailure } from "@/lib/api/result";

import type { InboxPage, Preferences } from "./types";

export const NOTIFICATIONS_PAGE_SIZE = 10;

export type InboxResult =
  { status: "ok"; page: InboxPage } | { status: "unavailable" };

export async function getInbox(page: number): Promise<InboxResult> {
  try {
    const api = await getApi();
    const result = await unwrap(
      api.GET("/notifications", {
        params: { query: { page, page_size: NOTIFICATIONS_PAGE_SIZE } },
        signal: pageTimeout(),
      }),
    );
    return { status: "ok", page: result };
  } catch (error) {
    logQueryFailure("notifications", String(error));
    return { status: "unavailable" };
  }
}

export type PreferencesResult =
  { status: "ok"; preferences: Preferences } | { status: "unavailable" };

export async function getPreferences(): Promise<PreferencesResult> {
  try {
    const api = await getApi();
    const preferences = await unwrap(
      api.GET("/users/me/notification-preferences", {
        signal: pageTimeout(),
      }),
    );
    return { status: "ok", preferences };
  } catch (error) {
    logQueryFailure("notification preferences", String(error));
    return { status: "unavailable" };
  }
}
