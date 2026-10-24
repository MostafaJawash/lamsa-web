"use client";

import dynamic from "next/dynamic";

/**
 * The sonner Toaster, loaded after hydration: toasts only follow user actions, so its
 * ~50 KB stay off the critical path of every first page load.
 */
export const DeferredToaster = dynamic(
  () => import("@/components/ui/sonner").then((mod) => mod.Toaster),
  { ssr: false },
);
