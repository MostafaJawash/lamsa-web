"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { showPendingFlash } from "../flash-client";

/** Renders nothing; shows the flash toast whenever the page hands it a new flash cookie. */
export function FlashPing({ raw }: { raw: string | null }) {
  const router = useRouter();
  useEffect(() => {
    showPendingFlash(raw, (href) => router.push(href));
  }, [raw, router]);
  return null;
}
