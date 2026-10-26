"use client";

import { useRouter } from "next/navigation";

import { BackIcon } from "@/components/shared/icons";

import { canGoBack } from "./nav-history";

/** Mobile header back button: history back, or home when the page was opened directly. */
export function BackButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="lm-icon-btn"
      aria-label={label}
      onClick={() => (canGoBack() ? router.back() : router.push("/"))}
    >
      <BackIcon />
    </button>
  );
}
