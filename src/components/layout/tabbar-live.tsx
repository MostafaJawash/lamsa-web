import { getBadgeCounts } from "@/features/cart/queries";
import { getCurrentUser } from "@/lib/auth/user";

import { Tabbar } from "./tabbar";

/** The tabbar with the session-dependent parts: "حسابي" (/account or /login) and the badges. */
export async function TabbarLive() {
  const [user, counts] = await Promise.all([
    getCurrentUser(),
    getBadgeCounts(),
  ]);
  return (
    <Tabbar
      accountHref={user ? "/account" : "/login"}
      counts={{ cart: counts?.cart ?? 0, favorites: counts?.favorites ?? 0 }}
    />
  );
}
