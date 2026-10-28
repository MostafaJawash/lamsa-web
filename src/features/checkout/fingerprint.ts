import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

export type CheckoutFingerprint = {
  attempt: string;
  addressId: number;
  deliveryMethodCode: string;
  totals: Partial<Record<"SYP" | "USD", string>>;
};

/** A compact signed snapshot carried in the checkout URL; it is authenticated, not secret. */
export function signCheckoutFingerprint(value: CheckoutFingerprint): string {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", env.CHECKOUT_SIGNING_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyCheckoutFingerprint(token: string): CheckoutFingerprint | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", env.CHECKOUT_SIGNING_SECRET)
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Partial<CheckoutFingerprint>;
    if (
      typeof value.attempt !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(value.attempt) ||
      !Number.isSafeInteger(value.addressId) || (value.addressId ?? 0) < 1 ||
      typeof value.deliveryMethodCode !== "string" ||
      !/^[a-z0-9_]{1,30}$/.test(value.deliveryMethodCode) ||
      !value.totals || typeof value.totals !== "object"
    ) return null;
    const totals = value.totals as Record<string, unknown>;
    const entries = Object.entries(totals);
    if (
      entries.length === 0 || entries.length > 2 ||
      entries.some(([currency, amount]) =>
        (currency !== "SYP" && currency !== "USD") ||
        typeof amount !== "string" || !/^\d{1,13}(?:\.\d{1,2})?$/.test(amount),
      )
    ) return null;
    return value as CheckoutFingerprint;
  } catch {
    return null;
  }
}
