import { getBadgeCounts } from "@/features/cart/queries";
import type { BadgeKind } from "@/features/cart/badge-store";

import { CountBadge } from "./count-badge";

/**
 * A badge's session-dependent hole (render inside <Suspense fallback={null}>): this
 * request's count seeds the client badge store. Backend unavailable: 0 (no badge).
 */
export async function BadgeLive({ kind }: { kind: BadgeKind }) {
  const counts = await getBadgeCounts();
  return <CountBadge kind={kind} initial={counts?.[kind] ?? 0} />;
}
