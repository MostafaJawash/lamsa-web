import { getCurrentUser } from "@/lib/auth/user";

import { Tabbar } from "./tabbar";

/** The tabbar with the session-dependent "حسابي" link (/account or /login). */
export async function TabbarLive() {
  const user = await getCurrentUser();
  return <Tabbar accountHref={user ? "/account" : "/login"} />;
}
