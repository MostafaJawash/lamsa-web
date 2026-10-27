"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * A page-level style rule that applies only while its page is visible. Next.js keeps
 * previous pages mounted but hidden (React Activity), and a hidden page's <style> would
 * still apply; the callback ref disables it on hide (media="not all"), as recommended
 * in the Next.js guide "Preserving UI state". Server-rendered enabled, so the first paint
 * is right without JavaScript.
 */
export function PageStyle({ css }: { css: string }) {
  return (
    <style
      data-page-style=""
      ref={(style) => {
        if (style) style.media = "";
        return () => {
          if (style) style.media = "not all";
        };
      }}
    >
      {css}
    </style>
  );
}

/**
 * Mounted once (SiteShell). A page left before it finished hydrating is hidden without
 * its ref ever running, so its style would stay on: after each navigation, every page
 * style follows the visibility of its own page.
 */
export function PageStyleSync() {
  const pathname = usePathname();
  useEffect(() => {
    const sync = () => {
      for (const style of document.querySelectorAll<HTMLStyleElement>(
        "style[data-page-style]",
      )) {
        // Activity hides a page's top-level nodes with an inline display: none.
        const hidden =
          style.style.display === "none" ||
          style.parentElement?.checkVisibility() === false;
        style.media = hidden ? "not all" : "";
      }
    };
    const frame = requestAnimationFrame(sync);
    const later = setTimeout(sync, 500);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(later);
    };
  }, [pathname]);
  return null;
}
