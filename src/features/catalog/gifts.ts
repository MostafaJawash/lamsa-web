import { GIFTS_CATEGORY_SLUG } from "@/config/site";
import { t } from "@/i18n";

import { getCategoryTiles, type CategoryTile } from "./queries";

export type GiftsEntry = {
  /** The backend category's own name, else the fallback label. */
  label: string;
  /** The category's picture, when the backend gave one. */
  image: CategoryTile["image"];
};

/**
 * The gift boxes entry point (Home tile, Categories tile, desktop nav link).
 * - the category has products: its own name and picture;
 * - the backend can't be read: the fallback label (the page itself shows its error state);
 * - the category is missing or has no products: `null`, the entry is hidden.
 */
export async function getGiftsEntry(): Promise<GiftsEntry | null> {
  const result = await getCategoryTiles();
  if (result.status === "unavailable")
    return { label: t("nav.gifts"), image: null };
  if (result.status === "empty") return null;
  const tile = result.data.find(({ slug }) => slug === GIFTS_CATEGORY_SLUG);
  if (!tile) return null;
  return { label: tile.name.trim() || t("nav.gifts"), image: tile.image };
}
