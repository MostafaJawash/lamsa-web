import Link from "next/link";

import { siteConfig } from "@/config/site";

/** Auth layout: a simple centered card with the logo, no shop navigation. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center justify-center px-4 py-10"
    >
      <Link
        href="/"
        className="mb-6 font-display text-4xl leading-none font-bold text-brand"
      >
        {siteConfig.name}
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface shadow-card">
        {children}
      </div>
    </main>
  );
}
