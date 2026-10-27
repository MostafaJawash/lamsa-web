"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { t } from "@/i18n";

const ForgotPasswordContent = dynamic(
  () => import("./forgot-password-content"),
  { ssr: false },
);

/**
 * The forgot-password link (prototype `.link`). The dialog (Radix, ~15 KB with its helpers)
 * loads on the first click; Radix returns the focus to this button when it closes.
 */
export function ForgotPasswordDialog() {
  const [open, setOpen] = useState<boolean | null>(null);
  return (
    <>
      <button
        type="button"
        className="lm-link"
        aria-haspopup="dialog"
        aria-expanded={open === true}
        onClick={() => setOpen(true)}
      >
        {t("auth.login.forgot")}
      </button>
      {open === null ? null : (
        <ForgotPasswordContent open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}
