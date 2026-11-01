import { call } from "./backend";
import { adminToken } from "./shop";

/**
 * Notification helpers for the tests. Inbox rows come from real actions only: the store
 * sends a message to one customer (admin API), or an order is placed / moved (see
 * checkout.ts). Nothing is written to the database directly.
 */

export type Link = { type: string; value?: string | null };

export type InboxItem = {
  id: number;
  type: string;
  title: string;
  body: string;
  link: Link;
  order_id: number | null;
  is_read: boolean;
};

export type Inbox = {
  items: InboxItem[];
  total: number;
  page: number;
  unread_count: number;
};

/** The store sends a message to one customer (POST /admin/notifications, audience "user"). */
export async function sendMessage(
  userId: number,
  title: string,
  body: string,
  link?: Link,
): Promise<number> {
  const created = await call<{ id: number }>("POST", "/admin/notifications", {
    token: await adminToken(),
    body: {
      audience: "user",
      user_id: userId,
      title,
      body,
      ...(link ? { link } : {}),
    },
  });
  return created.id;
}

export function inbox(token: string, page = 1, pageSize = 10): Promise<Inbox> {
  return call<Inbox>(
    "GET",
    `/notifications?page=${page}&page_size=${pageSize}`,
    { token },
  );
}

export async function unreadCount(token: string): Promise<number> {
  const result = await call<{ unread_count: number }>(
    "GET",
    "/notifications/unread-count",
    { token },
  );
  return result.unread_count;
}

/** Messages are queued and sent by the backend's worker: waits until `total` are in the inbox. */
export async function waitForInbox(
  token: string,
  total: number,
  timeoutMs = 20_000,
): Promise<Inbox> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const current = await inbox(token, 1, 1);
    if (current.total >= total) return inbox(token, 1, 100);
    if (Date.now() > deadline)
      throw new Error(`inbox has ${current.total} of ${total} notifications`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

export type Preferences = {
  order_updates: boolean;
  notify_marketing: boolean;
  notify_favorites: boolean;
  notify_cart_reminders: boolean;
};

export function preferences(token: string): Promise<Preferences> {
  return call<Preferences>("GET", "/users/me/notification-preferences", {
    token,
  });
}
