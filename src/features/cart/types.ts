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
export type CartPreview = Schema<"CartPreviewOut">;
export type CartPreviewLine = Schema<"CartPreviewLineOut">;
export type CartNotice = Schema<"CartNoticeOut">;
export type LineIssue = Schema<"LineIssue">;
export type DeliveryQuote = Schema<"DeliveryQuote">;
export type CartMergeResult = Schema<"CartMergeOut">;
export type CartCount = Schema<"CartCountOut">;

/** A stored cart (logged in) or the preview of the guest cart: rendered the same way. */
export type AnyCart = Cart | CartPreview;
export type AnyCartLine = CartLine | CartPreviewLine;

/** Badge numbers; a missing field means "unchanged". */
export type Counts = { cart?: number; favorites?: number };

/** A failed cart or favorites action (see lines.ts `cartErrorFrom`). */
export type CartError = {
  code: string;
  message: string;
  /** INSUFFICIENT_STOCK: how many are left. */
  available: number | null;
  /** QUANTITY_LIMIT_EXCEEDED / CART_LIMIT_REACHED / FAVORITES_LIMIT_REACHED: the limit. */
  max: number | null;
};

/** What every cart action returns to the client (never a token or another user's data). */
export type CartActionResult =
  | {
      ok: true;
      cart: AnyCart | null;
      counts: Counts;
      /** Toast texts for what the request changed (resolve issues). */
      notices?: string[];
    }
  | { ok: false; error: CartError; cart?: AnyCart | null; counts?: Counts };
