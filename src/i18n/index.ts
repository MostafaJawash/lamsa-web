import ar from "../../messages/ar.json";
import { defaultLocale, type Locale } from "./config";

export { defaultLocale, getDirection, locales, type Locale } from "./config";

export type Messages = typeof ar;

const dictionaries: Record<Locale, Messages> = { ar };

/** Dot paths to every string leaf, e.g. "pages.home" or "apiErrors.PHONE_TAKEN". */
type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? Leaves<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type PluralKey = keyof Messages["plurals"];
export type PluralForms = Messages["plurals"][PluralKey];
export type MessageParams = Record<string, string | number>;

export function getMessages(locale: Locale = defaultLocale): Messages {
  return dictionaries[locale];
}

export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

function lookup(messages: Messages, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Returns the text for `key`, with `{name}` placeholders replaced from `params`.
 * Keys are type-checked against messages/ar.json. Safe in server and client components.
 */
export function t(
  key: MessageKey,
  params?: MessageParams,
  locale: Locale = defaultLocale,
): string {
  return interpolate(lookup(getMessages(locale), key) ?? key, params);
}

/** Like `t()` for keys that are only known at runtime (e.g. backend error codes). */
export function tOptional(
  key: string,
  params?: MessageParams,
  locale: Locale = defaultLocale,
): string | undefined {
  const text = lookup(getMessages(locale), key);
  return text === undefined ? undefined : interpolate(text, params);
}
