/**
 * favorites: types.
 * Favorites (hearts): list, ids, add/remove, move to cart, and merging guest favorites after login.
 *
 * Belongs here: aliases of the generated backend schemas (src/lib/api/schema.d.ts) and
 * UI-only types of this feature. Never hand-write a type the backend already describes.
 */
import type { Schema } from "@/lib/api/types";

export type FavoriteIds = Schema<"FavoriteIds">;
export type FavoritesMergeResult = Schema<"FavoritesMergeOut">;
