import { t } from "@/i18n";

import { WORDMARK_PATH, WORDMARK_VIEW_BOX } from "./wordmark-data";

/**
 * The "لمسة" logo as SVG outlines of Reem Kufi 700 (scripts/build-wordmark.py), so the
 * header needs no web font. 1em high (the old line box), colored by `currentColor`.
 */
export function Wordmark() {
  return (
    <svg
      className="lm-wordmark"
      viewBox={WORDMARK_VIEW_BOX}
      role="img"
      aria-label={t("site.name")}
      focusable="false"
    >
      <path d={WORDMARK_PATH} fill="currentColor" />
    </svg>
  );
}
