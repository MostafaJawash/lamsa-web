/**
 * cart: types.
 * The cart: read, add, update, remove, resolve issues, and merging the guest cart after login.
 *
 * Belongs here: aliases of the generated backend schemas (src/lib/api/schema.d.ts) and
 * UI-only types of this feature. Never hand-write a type the backend already describes.
 */
import type { Schema } from "@/lib/api/types";

export type Cart = Schema<"CartOut">;
export type CartLine = Schema<"CartLineOut">;
export type CartNotice = Schema<"CartNoticeOut">;
export type LineIssue = Schema<"LineIssue">;
export type DeliveryQuote = Schema<"DeliveryQuote">;
export type CartMergeResult = Schema<"CartMergeOut">;
