/**
 * notifications: types.
 * The inbox: list, unread count (badge), mark read, mark all read.
 *
 * Belongs here: aliases of the generated backend schemas (src/lib/api/schema.d.ts) and
 * UI-only types of this feature. Never hand-write a type the backend already describes.
 */
import type { Schema } from "@/lib/api/types";

export type Notification = Schema<"NotificationOut">;
export type InboxPage = Schema<"InboxPage">;
export type UnreadCount = Schema<"UnreadCountOut">;
