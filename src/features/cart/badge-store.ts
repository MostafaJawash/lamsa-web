import type { Counts } from "./types";

/**
 * The header and tabbar badges: one tiny store, no context provider. Server holes seed
 * it (the counts they read for this request), every cart or favorites mutation writes
 * the numbers it got back, and the badges subscribe with useSyncExternalStore. Values
 * are null until seeded, so a badge shows its server-rendered prop until then.
 */
export type BadgeKind = "cart" | "favorites";

type Listener = () => void;

const values: Record<BadgeKind, number | null> = {
  cart: null,
  favorites: null,
};
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export const badgeStore = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get(kind: BadgeKind): number | null {
    return values[kind];
  },
  /** Writes the counts that are present; ignores negatives and non-integers. */
  set(counts: Counts) {
    let changed = false;
    for (const kind of ["cart", "favorites"] as const) {
      const value = counts[kind];
      if (value === undefined || !Number.isInteger(value) || value < 0)
        continue;
      if (values[kind] !== value) {
        values[kind] = value;
        changed = true;
      }
    }
    if (changed) emit();
  },
  /** Optimistic change (a heart toggled); returns the undo. */
  add(kind: BadgeKind, delta: number): () => void {
    const before = values[kind];
    if (before === null) return () => {};
    values[kind] = Math.max(0, before + delta);
    emit();
    return () => {
      values[kind] = Math.max(0, (values[kind] ?? 0) - delta);
      emit();
    };
  },
  /** Tests only. */
  reset() {
    values.cart = null;
    values.favorites = null;
    emit();
  },
};

/** "99+" above 99, as the prototype badge has room for three characters. */
export function badgeText(count: number): string {
  return count > 99 ? "99+" : String(count);
}
