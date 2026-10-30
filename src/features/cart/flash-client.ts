import type { Route } from "next";

import { decodeFlash, FLASH_COOKIE, flashToast } from "./flash";
import { showToast } from "./toast";

const SHOWN_KEY = "lamsa_flash_shown";

/** The flash cookie as the browser holds it (it is not httpOnly: codes and counts only). */
export function readFlashCookie(): string | null {
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${FLASH_COOKIE}=`));
  return match
    ? decodeURIComponent(match.slice(FLASH_COOKIE.length + 1))
    : null;
}

function alreadyShown(id: string): boolean {
  try {
    const shown = sessionStorage.getItem(SHOWN_KEY)?.split(",") ?? [];
    if (shown.includes(id)) return true;
    sessionStorage.setItem(SHOWN_KEY, [...shown.slice(-9), id].join(","));
  } catch {
    // Storage blocked: show it (at worst twice).
  }
  return false;
}

/**
 * Shows the pending flash toast, once: the cookie a server action left before a redirect
 * (read and deleted here), or `fallback` (the value the proxy handed to the page). Every
 * flash has an id, so the controller and a page that both look at the same flash show it
 * only once.
 */
export function showPendingFlash(
  fallback: string | null,
  navigate: (href: Route) => void,
): void {
  const raw = readFlashCookie() ?? fallback;
  if (!raw) return;
  document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
  const decoded = decodeFlash(raw);
  if (!decoded || alreadyShown(decoded.id)) return;
  const view = flashToast(decoded.flash);
  if (view) showToast(view, navigate);
}
