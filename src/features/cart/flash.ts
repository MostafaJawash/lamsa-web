import type { Route } from "next";

import { t } from "@/i18n";
import { pluralize } from "@/lib/format";

import { cartError, cartErrorText } from "./lines";

/**
 * One-shot toast after a redirect (login merge; forms posted without JavaScript).
 * The cookie is NOT httpOnly: the client controller reads and deletes it. It holds only
 * a random id and codes/counts, never names, ids or tokens: `v1.<id>.<kind>[.<a>[.<b>]]`.
 * Without JavaScript the proxy hands it to the page once (see src/proxy.ts).
 */
export const FLASH_COOKIE = "lamsa_flash";
export const FLASH_HEADER = "x-lamsa-flash";
export const FLASH_MAX_AGE = 60;

export type Flash =
  | { kind: "merge"; restored: number; adjusted: boolean }
  | { kind: "cartAdded" }
  | { kind: "favAdded" }
  | { kind: "favRemoved" }
  | { kind: "moved" }
  | { kind: "addressSaved" }
  | { kind: "addressDeleted" }
  | { kind: "addressDefault" }
  | { kind: "orderCancelled" }
  | { kind: "error"; code: string; n: number | null };

export type FlashToast = {
  text: string;
  sub?: string;
  action?: { label: string; href: Route };
};

const SIMPLE = [
  "cartAdded",
  "favAdded",
  "favRemoved",
  "moved",
  "addressSaved",
  "addressDeleted",
  "addressDefault",
  "orderCancelled",
] as const;
const CODE = /^[A-Z][A-Z_]{1,40}$/;
const ID = /^[a-z0-9]{6,16}$/;

export function newFlashId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

export function encodeFlash(flash: Flash, id: string = newFlashId()): string {
  const parts = ["v1", id, flash.kind];
  if (flash.kind === "merge")
    parts.push(String(flash.restored), flash.adjusted ? "1" : "0");
  if (flash.kind === "error") {
    parts.push(flash.code);
    if (flash.n !== null) parts.push(String(flash.n));
  }
  return parts.join(".");
}

function count(value: string | undefined): number | null {
  return value !== undefined && /^\d{1,6}$/.test(value) ? Number(value) : null;
}

export function decodeFlash(
  raw: string | null | undefined,
): { id: string; flash: Flash } | null {
  if (!raw || raw.length > 120) return null;
  const [version, id, kind, a, b, ...rest] = raw.split(".");
  if (version !== "v1" || !id || !ID.test(id) || rest.length > 0) return null;
  if ((SIMPLE as readonly string[]).includes(kind ?? ""))
    return a === undefined
      ? { id, flash: { kind: kind as (typeof SIMPLE)[number] } }
      : null;
  if (kind === "merge") {
    const restored = count(a);
    if (restored === null || (b !== "0" && b !== "1")) return null;
    return { id, flash: { kind, restored, adjusted: b === "1" } };
  }
  if (
    kind === "error" &&
    a &&
    CODE.test(a) &&
    (b === undefined || count(b) !== null)
  )
    return { id, flash: { kind, code: a, n: count(b) } };
  return null;
}

/** The toast for a flash; null when there is nothing to say (an empty merge). */
export function flashToast(flash: Flash): FlashToast | null {
  switch (flash.kind) {
    case "merge":
      if (flash.restored === 0 && !flash.adjusted) return null;
      return {
        text:
          flash.restored > 0
            ? t("toast.merged", {
                products: pluralize(flash.restored, "products"),
              })
            : t("toast.mergedAdjusted"),
        sub:
          flash.restored > 0 && flash.adjusted
            ? t("toast.mergedAdjusted")
            : undefined,
        action: { label: t("toast.cartAction"), href: "/cart" },
      };
    case "cartAdded":
      return {
        text: t("toast.cartAdded"),
        action: { label: t("toast.cartAction"), href: "/cart" },
      };
    case "favAdded":
      return {
        text: t("toast.favAdded"),
        action: { label: t("toast.favAction"), href: "/favorites" },
      };
    case "favRemoved":
      return { text: t("toast.favRemoved") };
    case "moved":
      return {
        text: t("toast.moved"),
        action: { label: t("toast.movedAction"), href: "/cart" },
      };
    case "addressSaved":
      return { text: t("toast.addressSaved") };
    case "addressDeleted":
      return { text: t("toast.addressDeleted") };
    case "addressDefault":
      return { text: t("toast.addressDefault") };
    case "orderCancelled":
      return { text: t("toast.orderCancelled") };
    case "error":
      return {
        text: cartErrorText(
          cartError(flash.code, { available: flash.n, max: flash.n }),
        ),
      };
  }
}

/**
 * What the merge report says for the toast: lines restored (added, merged or capped)
 * and whether anything was capped or skipped.
 */
export function mergeFlash(
  report: readonly { status: string }[],
): Extract<Flash, { kind: "merge" }> {
  const restored = report.filter((r) => r.status !== "skipped").length;
  const adjusted = report.some(
    (r) => r.status === "capped" || r.status === "skipped",
  );
  return { kind: "merge", restored, adjusted };
}
