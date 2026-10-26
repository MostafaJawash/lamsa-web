import type { Metadata } from "next";
import { Suspense } from "react";

import { AccountShell } from "@/components/layout/account-shell";
import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import {
  ProfileCard,
  ProfileCardSkeleton,
} from "@/features/auth/components/profile-card";
import { t } from "@/i18n";
import { ACCOUNT_PATH } from "@/lib/auth/paths";
import { requireUser } from "@/lib/auth/user";

export const metadata: Metadata = {
  title: t("pages.account"),
  robots: { index: false },
};

async function Profile() {
  const user = await requireUser(ACCOUNT_PATH);
  if (!user) return <p className="lm-err">{t("auth.account.unavailable")}</p>;
  return <ProfileCard user={user} />;
}

/** Account placeholder: the profile card; the account sections come later. */
export default function AccountPage() {
  return (
    <PageChrome path={ACCOUNT_PATH}>
      <AccountShell>
        <PageTitle>{t("pages.account")}</PageTitle>
        <div className="mt-3">
          <Suspense fallback={<ProfileCardSkeleton />}>
            <Profile />
          </Suspense>
        </div>
      </AccountShell>
    </PageChrome>
  );
}
