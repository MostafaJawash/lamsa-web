import Link from "next/link";

import { UserIcon } from "@/components/shared/icons";
import { t } from "@/i18n";
import { getBadgeCounts } from "@/features/cart/queries";
import { getCurrentUser } from "@/lib/auth/user";

import { CountBadge } from "./count-badge";

/**
 * Desktop header account entry (prototype `.icon-btn` with `S.user.name.split(' ')[0]`
 * or "تسجيل الدخول"). The label has a fixed width (the guest label's), so swapping it
 * for the name never moves the header; longer names end in an ellipsis.
 */
export function AccountEntry({
  firstName,
  unread,
}: {
  firstName: string | null;
  /** Unread notifications: the badge on the icon (signed-in visitors only). */
  unread?: number;
}) {
  return (
    <Link
      href={firstName ? "/account" : "/login"}
      className="lm-icon-btn lm-acct"
    >
      <UserIcon />
      <span>{firstName ?? t("layout.login")}</span>
      {firstName && unread !== undefined ? (
        <CountBadge kind="notifications" initial={unread} />
      ) : null}
    </Link>
  );
}

/** Session-dependent: render inside <Suspense fallback={<AccountEntry firstName={null} />}>. */
export async function AccountEntryLive() {
  const [user, counts] = await Promise.all([
    getCurrentUser(),
    getBadgeCounts(),
  ]);
  const firstName = user?.name.trim().split(/\s+/)[0] || null;
  return (
    <AccountEntry firstName={firstName} unread={counts?.notifications ?? 0} />
  );
}
