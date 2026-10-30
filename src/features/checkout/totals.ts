/**
 * Per-currency totals in checkout. The backend computes them (a bucket per currency, never
 * summed across currencies); this only moves them between the page, the form and the order
 * request. No arithmetic on amounts happens here or anywhere on the website.
 */
export type Currency = "SYP" | "USD";

export type CurrencyAmount = { currency: Currency; amount: string };

const CURRENCIES: readonly Currency[] = ["SYP", "USD"];
const AMOUNT = /^\d{1,13}\.\d{2}$/;

/** The backend's money string: digits with exactly two decimals ("15000.00"). */
export function isMoney(value: unknown): value is string {
  return typeof value === "string" && AMOUNT.test(value);
}

function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

/** `[{currency, amount}]` as the backend returns it → `{SYP: "…", USD: "…"}`. */
export function totalsToMap(
  totals: readonly { currency: string; amount: string }[],
): Partial<Record<Currency, string>> {
  const map: Partial<Record<Currency, string>> = {};
  for (const { currency, amount } of totals)
    if (isCurrency(currency)) map[currency] = amount;
  return map;
}

/** The hidden form field that carries the totals the customer is looking at. */
export function serializeTotals(
  totals: readonly { currency: string; amount: string }[],
): string {
  return JSON.stringify(totalsToMap(totals));
}

/**
 * Reads that field back. null when it is not a JSON object with one or two known
 * currencies and well-formed amounts (a tampered or missing field is refused, not guessed).
 */
export function parseTotals(
  raw: unknown,
): Partial<Record<Currency, string>> | null {
  if (typeof raw !== "string" || raw.length > 200) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return null;
  const entries = Object.entries(parsed);
  if (entries.length < 1 || entries.length > 2) return null;
  const map: Partial<Record<Currency, string>> = {};
  for (const [currency, amount] of entries) {
    if (!isCurrency(currency) || !isMoney(amount)) return null;
    map[currency] = amount;
  }
  return map;
}
