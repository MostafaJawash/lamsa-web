/**
 * orders: types.
 * Checkout (POST /orders with an Idempotency-Key), order history, order detail, cancel and reorder.
 *
 * Belongs here: aliases of the generated backend schemas (src/lib/api/schema.d.ts) and
 * UI-only types of this feature. Never hand-write a type the backend already describes.
 */
import type { Schema } from "@/lib/api/types";

export type OrderCreate = Schema<"OrderCreate">;
export type OrderSummary = Schema<"OrderSummaryOut">;
export type OrderSummaryPage = Schema<"Page_OrderSummaryOut_">;
export type OrderDetail = Schema<"OrderDetailOut">;
export type TimelineStep = Schema<"TimelineStepOut">;
