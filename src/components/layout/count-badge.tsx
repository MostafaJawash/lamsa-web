"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  badgeStore,
  badgeText,
  type BadgeKind,
} from "@/features/cart/badge-store";

/**
 * Prototype `.badge` (cart / favorites counts on the header icons and tabbar tabs).
 * `initial` comes from a small server hole (this request's counts) and seeds the shared
 * badge store; after that every cart or favorites mutation updates all badges at once
 * without a reload. Renders nothing for 0. Absolutely positioned: nothing moves.
 */
export function CountBadge({
  kind,
  initial,
}: {
  kind: BadgeKind;
  initial: number;
}) {
  useEffect(() => {
    badgeStore.set({ [kind]: initial });
  }, [kind, initial]);
  const count = useSyncExternalStore(
    badgeStore.subscribe,
    () => badgeStore.get(kind) ?? initial,
    () => initial,
  );
  if (count <= 0) return null;
  return <i className="lm-badge">{badgeText(count)}</i>;
}
