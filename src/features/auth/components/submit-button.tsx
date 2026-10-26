"use client";

import { t } from "@/i18n";

import { useHydrated } from "./use-auth-submit";

/**
 * Prototype `.btn.primary.block`; disabled while pending or locked (no double submit)
 * and until hydrated (no native submit that skips the action).
 */
export function SubmitButton({
  label,
  pending,
  disabled = false,
}: {
  label: string;
  pending: boolean;
  disabled?: boolean;
}) {
  const hydrated = useHydrated();
  return (
    <button
      type="submit"
      className="lm-btn primary block"
      disabled={!hydrated || pending || disabled}
      aria-busy={pending || undefined}
    >
      {pending ? t("auth.pending") : label}
    </button>
  );
}
