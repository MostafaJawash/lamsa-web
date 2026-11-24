"use client";

import { useSyncExternalStore } from "react";

import { MoonIcon, SunIcon } from "@/components/shared/icons";
import { t } from "@/i18n";
import {
  currentTheme,
  setTheme,
  THEME_CHANGE_EVENT,
  type Theme,
} from "@/lib/theme";

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
}

/**
 * Light / dark switch. The server (and the first client render) always say "light", the
 * truth the static HTML was drawn with; the real theme, which the head script set before
 * paint, is read right after hydration.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore<Theme>(
    subscribe,
    currentTheme,
    () => "light",
  );
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className={className ?? "lm-theme-toggle"}
      aria-pressed={dark}
      data-testid="theme-toggle"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
      <span>{t(dark ? "theme.switchToLight" : "theme.switchToDark")}</span>
    </button>
  );
}
