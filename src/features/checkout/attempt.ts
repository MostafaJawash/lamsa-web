/**
 * Checkout attempts and idempotency keys (server-only: Node crypto).
 *
 * Every render of /checkout is the start of an attempt and gets a fresh random id, carried
 * in a hidden field. The Idempotency-Key sent to the backend is derived from that id and
 * the material inputs the customer is confirming (address, delivery method, notes, gift
 * message and the totals on screen):
 *
 * - a genuine retry (double click, an automatic retry after "service busy") submits the
 *   same id with the same inputs, so it derives the same key and the backend returns the
 *   order it already created instead of making a second one;
 * - changing anything material before confirming derives a different key, so it can never
 *   be mistaken for the earlier attempt;
 * - a refreshed page (after a price change, a new address, …) has a new id, so the customer
 *   always confirms anew with a new key.
 *
 * Nothing here is secret or signed: the key only has to be unique per attempt, and the
 * backend scopes it to the signed-in customer and checks the totals itself.
 */
import { createHash, randomUUID } from "node:crypto";

import type { Currency } from "./totals";

export type AttemptSnapshot = {
  addressId: number;
  method: string;
  notes: string;
  gift: string;
  /** The per-currency totals the customer is looking at. */
  totals: Partial<Record<Currency, string>>;
};

const ATTEMPT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function newAttemptId(): string {
  return randomUUID();
}

export function isAttemptId(value: unknown): value is string {
  return typeof value === "string" && ATTEMPT_ID.test(value);
}

/** The snapshot in one canonical form: trimmed texts (the backend trims them too), currencies in order. */
function canonical(snapshot: AttemptSnapshot): string {
  return JSON.stringify([
    snapshot.addressId,
    snapshot.method,
    snapshot.notes.trim(),
    snapshot.gift.trim(),
    (["SYP", "USD"] as const).map((currency) => [
      currency,
      snapshot.totals[currency] ?? null,
    ]),
  ]);
}

/**
 * The Idempotency-Key for an attempt and the inputs confirmed with it: 43 characters of
 * base64url (the backend accepts 1..64 of letters, digits, `-` and `_`).
 */
export function idempotencyKey(
  attemptId: string,
  snapshot: AttemptSnapshot,
): string {
  return createHash("sha256")
    .update(attemptId)
    .update("\u0000")
    .update(canonical(snapshot))
    .digest("base64url");
}
