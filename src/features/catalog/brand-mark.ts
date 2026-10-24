/** Brand colors of the prototype (BRANDS[].color), used for logo-less brands. */
export const BRAND_COLORS = [
  "#B8174E",
  "#7A4E9C",
  "#C8607F",
  "#B88A2E",
  "#6B4430",
  "#3F7253",
  "#2D1B2E",
] as const;

/** Arabic tashkeel (U+064B–U+0652), removed like the prototype `norm()`. */
const DIACRITICS = /[ً-ْ]/g;

/** First letter of the name without diacritics, e.g. "لُمى" → "ل". */
export function monogram(name: string): string {
  const letter = [...name.replace(DIACRITICS, "").trim()][0];
  return letter ?? "";
}

/**
 * Deterministic color for a brand id: an integer hash (Knuth multiplicative) picks one of
 * the prototype brand colors, so a brand keeps its color everywhere.
 */
export function brandColor(id: number): string {
  const hash = Math.imul(Math.trunc(id) ^ 0x5bd1e995, 2654435761) >>> 0;
  return BRAND_COLORS[hash % BRAND_COLORS.length] ?? BRAND_COLORS[0];
}
