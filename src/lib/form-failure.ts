import "server-only";

import { randomBytes } from "node:crypto";

/**
 * Short-lived hand-over of a failed form post to the page that shows it again.
 *
 * With JavaScript a server action returns its failure to `useActionState` directly. A plain
 * form post (no JavaScript) cannot: Next.js does not render the action's state into the HTML
 * of that response, so the action redirects back to the form with `?fs=<id>` and the page
 * reads the failure here. The id is unguessable and the content is only ever put there by
 * the server, so a crafted link cannot make the page say something. The store lives in the
 * process, for a few minutes: another process (or a restart) simply shows the form without
 * the message, and the customer submits again.
 */
type Entry = { value: unknown; expires: number };

const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 500;
const ID = /^[A-Za-z0-9_-]{16,40}$/;

const KEY = Symbol.for("lamsa.formFailures");
type Holder = { [KEY]?: Map<string, Entry> };
const holder = globalThis as unknown as Holder;
const store: Map<string, Entry> = (holder[KEY] ??= new Map());

function sweep(now: number): void {
  for (const [id, entry] of store) if (entry.expires <= now) store.delete(id);
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/** Keeps a failure and returns the id for `?fs=`. */
export function putFailure(value: unknown): string {
  const now = Date.now();
  sweep(now);
  const id = randomBytes(18).toString("base64url");
  store.set(id, { value, expires: now + TTL_MS });
  return id;
}

/**
 * The failure for `?fs=`, or null. Not removed on read (a render may run twice, and a
 * reload showing the same message is harmless); it expires after a few minutes.
 */
export function readFailure<T>(id: string | string[] | undefined): T | null {
  const raw = Array.isArray(id) ? id[0] : id;
  if (!raw || !ID.test(raw)) return null;
  const entry = store.get(raw);
  if (!entry) return null;
  return entry.expires > Date.now() ? (entry.value as T) : null;
}
