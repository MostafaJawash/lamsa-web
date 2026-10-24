/**
 * banners: types.
 * Home page banners (public, at most 10, in the admin's order).
 *
 * Belongs here: aliases of the generated backend schemas (src/lib/api/schema.d.ts) and
 * UI-only types of this feature. Never hand-write a type the backend already describes.
 */
import type { Schema } from "@/lib/api/types";

export type Banner = Schema<"BannerOut">;
export type Link = Schema<"LinkOut">;
