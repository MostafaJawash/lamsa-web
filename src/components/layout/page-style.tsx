"use client";

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
