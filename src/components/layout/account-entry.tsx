import Link from "next/link";

import { UserIcon } from "@/components/shared/icons";
import { t } from "@/i18n";
import { getCurrentUser } from "@/lib/auth/user";

/**
 * Desktop header account entry (prototype `.icon-btn` with `S.user.name.split(' ')[0]`
 * or "تسجيل الدخول"). The label has a fixed width (the guest label's), so swapping it
 * for the name never moves the header; longer names end in an ellipsis.
 */
export function AccountEntry({ firstName }: { firstName: string | null }) {
  return (
    <Link
      href={firstName ? "/account" : "/login"}
      className="lm-icon-btn lm-acct"
    >
      <UserIcon />
      <span>{firstName ?? t("layout.login")}</span>
    </Link>
  );
}

/** Session-dependent: render inside <Suspense fallback={<AccountEntry firstName={null} />}>. */
export async function AccountEntryLive() {
  const user = await getCurrentUser();
  const firstName = user?.name.trim().split(/\s+/)[0] || null;
  return <AccountEntry firstName={firstName} />;
}
