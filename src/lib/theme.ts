/**
 * Light / dark theme. The site is ALWAYS light for a new visitor, whatever the device
 * prefers; dark is reachable only through the toggle (footer, account settings), and the
 * choice is remembered in a cookie.
 *
 * The root layout stays static (Cache Components), so it cannot read the cookie on the
 * server: a tiny blocking script in <head> reads it before first paint and sets
 * `data-theme="dark"` on <html> (the CSS tokens key off that attribute). Without the
 * cookie, or without JavaScript, the page is light.
 */
export type Theme = "light" | "dark";

export const THEME_COOKIE = "lamsa-theme";
export const THEME_CHANGE_EVENT = "lamsa-theme-change";
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Browser chrome colors (the <meta name="theme-color">), kept equal to `--lamsa-bg`. */
export const THEME_COLORS: Record<Theme, string> = {
  light: "#F7F0F2",
  dark: "#161015",
};

/** Runs in <head> before first paint (plain ES5, no dependencies). */
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(dark|light)/);if(m&&m[1]==="dark"){document.documentElement.setAttribute("data-theme","dark");var e=document.querySelector('meta[name="theme-color"]');if(e)e.setAttribute("content","${THEME_COLORS.dark}")}}catch(_){}})()`;

/** The theme currently applied to the page. */
export function currentTheme(root: HTMLElement = document.documentElement) {
  return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/** Applies and remembers a theme (client only). */
export function setTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", THEME_COLORS[theme]));
  try {
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    // Cookies blocked: the choice lasts until the page is closed.
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
