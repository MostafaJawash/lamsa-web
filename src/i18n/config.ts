/**
 * Locale configuration. Only Arabic for now.
 *
 * To add a language later: add it to `locales`, add `messages/<locale>.json`, move the
 * route groups under `src/app/[locale]/` and pass the locale to `getMessages()` / `t()`.
 */
export const locales = ["ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ar";

const rtlLocales: ReadonlySet<Locale> = new Set<Locale>(["ar"]);

export function getDirection(locale: Locale): "rtl" | "ltr" {
  return rtlLocales.has(locale) ? "rtl" : "ltr";
}
