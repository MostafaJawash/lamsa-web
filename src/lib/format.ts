import { getMessages, interpolate, type PluralKey } from "@/i18n";

/**
 * Formatting helpers. Numbers use Latin digits, as in the prototype:
 * prices look like "8,95 €" and "1.234,50 €" (store in Germany, Arabic UI).
 */

const MONEY = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Formats a backend money string (always two decimals, e.g. "8.95") without going
 * through floating point. Returns the input unchanged if it isn't a money string.
 */
export function formatPrice(amount: string): string {
  const match = MONEY.exec(amount.trim());
  if (!match) return amount;
  const [, sign = "", whole = "0", fraction = ""] = match;
  const grouped = whole
    .replace(/^0+(?=\d)/, "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${grouped},${fraction.padEnd(2, "0")} €`;
}

/**
 * Sum of backend money strings ("8.95" + "4.95" → "13.90"), in integer cents, for
 * display only (the cart total = subtotal + shipping). Non-money input counts as 0.
 */
export function addMoney(...amounts: string[]): string {
  let cents = 0;
  for (const amount of amounts) {
    const match = MONEY.exec(amount.trim());
    if (!match) continue;
    const [, sign, whole = "0", fraction = ""] = match;
    const value = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    cents += sign ? -value : value;
  }
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const STORE_TIME_ZONE = "Europe/Berlin";

const dateFormatters = {
  date: new Intl.DateTimeFormat("ar-u-nu-latn", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: STORE_TIME_ZONE,
  }),
  dateTime: new Intl.DateTimeFormat("ar-u-nu-latn", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: STORE_TIME_ZONE,
  }),
} as const;

/**
 * Formats a date in Arabic (Gregorian calendar, Latin digits, store time zone).
 * Backend timestamps are UTC; strings without an offset are read as UTC.
 */
export function formatDate(
  value: string | Date,
  style: keyof typeof dateFormatters = "date",
): string {
  const date = typeof value === "string" ? parseUtc(value) : value;
  if (Number.isNaN(date.getTime()))
    return typeof value === "string" ? value : "";
  return dateFormatters[style].format(date);
}

function parseUtc(value: string): Date {
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasZone || !value.includes("T") ? value : `${value}Z`);
}

const pluralRules = new Intl.PluralRules("ar");

/**
 * Arabic plural for a count, using the forms in messages/ar.json `plurals.<key>`
 * (zero / one / two / few / many / other), e.g. `pluralize(3, "products")` → "3 منتجات".
 */
export function pluralize(count: number, key: PluralKey): string {
  const forms = getMessages().plurals[key];
  const category = pluralRules.select(count) as keyof typeof forms;
  return interpolate(forms[category] ?? forms.other, { count });
}

const arabicIndic = new Intl.NumberFormat("ar-u-nu-arab", {
  useGrouping: false,
});

/** A year in Arabic-Indic digits, e.g. 2026 → "٢٠٢٦" (footer only, as in the prototype). */
export function formatYearArabic(year: number): string {
  return arabicIndic.format(year);
}
