import type { Metadata } from "next";
import { Suspense } from "react";

import { PageChrome } from "@/components/layout/page-chrome";
import { AuthHeader } from "@/features/auth/components/auth-header";
import { LoginForm } from "@/features/auth/components/login-form";
import { googleMode } from "@/features/auth/google";
import { t } from "@/i18n";
import { safeNext } from "@/lib/auth/next-param";

export const metadata: Metadata = { title: t("pages.login") };

/** Prototype `.note` shown when the visitor came from checkout. */
async function CheckoutNote({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const { next } = await searchParams;
  if (!safeNext(next).startsWith("/checkout")) return null;
  return <p className="lm-note">{t("auth.login.checkoutNote")}</p>;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <PageChrome path="/login" width="narrow">
      <AuthHeader title={t("pages.login")} lead={t("auth.login.lead")} />
      <LoginForm google={googleMode()} />
      <Suspense fallback={null}>
        <CheckoutNote searchParams={searchParams} />
      </Suspense>
    </PageChrome>
  );
}
