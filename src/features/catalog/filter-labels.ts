import { t } from "@/i18n";
import { formatPrice } from "@/lib/format";

import {
  activeFilters,
  pricePreset,
  value,
  type FilterPair,
  type ListFilters,
} from "./filters";
import type { Facets } from "./types";

/** One removable chip: the pairs it removes and its text. */
export type FilterChip = { label: string; remove: FilterPair[] };

const PRESET_LABEL = {
  lt5: "list.priceLt5",
  "5to15": "list.price5to15",
  gt15: "list.priceGt15",
} as const;

/** "8,95 €" without the bidi isolation (chips are plain text). */
function money(amount: string): string {
  return formatPrice(Number(amount).toFixed(2));
}

/**
 * The active filters as chips (prototype tokens), labeled with the facet names: brand
 * names, "نوع البشرة: جافة", option values, the price range, "المتوفر فقط", …
 */
export function filterChips(
  filters: ListFilters,
  facets: Facets | null,
): FilterChip[] {
  const chips: FilterChip[] = [];
  const attrLabel = (key: string) =>
    facets?.attributes.find((a) => a.key === key)?.label ?? key;
  const optLabel = (key: string) =>
    facets?.options.find((o) => o.key === key)?.label ?? key;

  const min = value(filters, "min_price");
  const max = value(filters, "max_price");
  if (min || max) {
    const preset = pricePreset(filters);
    const range =
      preset && preset !== "custom"
        ? t(PRESET_LABEL[preset])
        : min && max
          ? t("list.priceBetween", { min: money(min), max: money(max) })
          : min
            ? t("list.priceFrom", { min: money(min) })
            : t("list.priceTo", { max: money(max ?? "0") });
    const remove: FilterPair[] = [];
    if (min) remove.push(["min_price", min]);
    if (max) remove.push(["max_price", max]);
    chips.push({ label: t("list.priceRange", { range }), remove });
  }

  const ranges = new Map<string, { min?: string; max?: string }>();
  for (const pair of activeFilters(filters)) {
    const [name, val] = pair;
    if (name === "min_price" || name === "max_price") continue;
    if (name === "brand") {
      chips.push({
        label: facets?.brands.find((b) => b.slug === val)?.name ?? val,
        remove: [pair],
      });
    } else if (name === "on_sale") {
      chips.push({ label: t("list.onSale"), remove: [pair] });
    } else if (name.startsWith("opt.")) {
      chips.push({
        label: `${optLabel(name.slice(4))}: ${val}`,
        remove: [pair],
      });
    } else if (name.startsWith("attr.")) {
      const range = /^attr\.(.+)\.(min|max)$/.exec(name);
      if (range) {
        const key = range[1] ?? "";
        const entry = ranges.get(key) ?? {};
        entry[range[2] as "min" | "max"] = val;
        ranges.set(key, entry);
        continue;
      }
      const key = name.slice(5);
      const text =
        val === "true" ? t("list.yes") : val === "false" ? t("list.no") : val;
      chips.push({ label: `${attrLabel(key)}: ${text}`, remove: [pair] });
    }
  }
  for (const [key, { min: lo, max: hi }] of ranges) {
    const unit = facets?.attributes.find((a) => a.key === key)?.unit ?? "";
    const text =
      lo && hi
        ? `${lo}–${hi}`
        : lo
          ? t("list.priceFrom", { min: lo })
          : t("list.priceTo", { max: hi ?? "" });
    const remove: FilterPair[] = [];
    if (lo) remove.push([`attr.${key}.min`, lo]);
    if (hi) remove.push([`attr.${key}.max`, hi]);
    chips.push({
      label: `${attrLabel(key)}: ${text}${unit ? ` ${unit}` : ""}`,
      remove,
    });
  }
  return chips;
}
