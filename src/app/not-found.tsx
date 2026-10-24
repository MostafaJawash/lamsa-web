import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("errors.notFoundTitle") };

export default function NotFound() {
  return (
    <>
      <Header />
      <main
        id="main"
        className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center"
      >
        <h1 className="text-3xl font-semibold">{t("errors.notFoundTitle")}</h1>
        <p className="text-ink-muted">{t("errors.notFoundBody")}</p>
        <Button asChild>
          <Link href="/">{t("common.backHome")}</Link>
        </Button>
      </main>
      <Footer />
    </>
  );
}
