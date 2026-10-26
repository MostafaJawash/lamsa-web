"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { support } from "@/config/site";
import { t } from "@/i18n";

/**
 * "نسيت كلمة السر؟": there is no self-service reset. The store gives a temporary
 * password by phone (backend README "Forgot password"). shadcn Dialog with the
 * prototype tokens (surface, ink, line, 18px radius). Loaded on the first click by
 * ./forgot-password-dialog.tsx (Radix and tailwind-merge stay out of the page's JS).
 */
export default function ForgotPasswordContent({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tel = support.phone.replace(/[^\d+]/g, "");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 rounded-[18px] border border-line bg-surface p-5 text-ink ring-0 sm:max-w-[380px]">
        <DialogTitle className="font-display text-xl font-semibold">
          {t("auth.forgot.title")}
        </DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-ink-muted">
          {t("auth.forgot.body")}
        </DialogDescription>
        {tel ? (
          <a href={`tel:${tel}`} className="lm-btn primary block">
            {t("auth.forgot.call")}
            <span className="lm-num" dir="ltr">
              {support.phone}
            </span>
          </a>
        ) : null}
        {support.whatsapp ? (
          <a
            href={`https://wa.me/${support.whatsapp}`}
            className="lm-btn ghost block"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("auth.forgot.whatsapp")}
          </a>
        ) : null}
        {!tel && !support.whatsapp ? (
          <p className="lm-note">{t("auth.forgot.noContact")}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
