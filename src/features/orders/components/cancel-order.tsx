"use client";

import { useId, useState, useTransition } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { showToast } from "@/features/cart/toast";
import { t } from "@/i18n";

import { cancelOrder, cancelOrderForm } from "../actions";

/**
 * "إلغاء الطلب": a confirmation dialog with an optional reason. On the backend's "not
 * cancellable any more" (the store moved the order on) it shows that message as a toast and
 * the page refreshes to the order's real state. Without JavaScript the same form sits in a
 * plain disclosure.
 */
export function CancelOrder({ orderId }: { orderId: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const titleId = useId();
  const reasonId = useId();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        // Success redirects (back to this page, now cancelled); a failure returns the
        // backend's message. The toast is shown here, not from an effect: the page behind
        // re-renders without this component, and the message must outlive it.
        const failure = await cancelOrder(null, data);
        if (failure) {
          setOpen(false);
          showToast({ text: failure.message });
        }
      } catch {
        showToast({ text: t("errors.generic") });
      }
    });
  };

  const fields = (
    <>
      <input type="hidden" name="id" value={orderId} />
      <div className="lm-fld">
        <label htmlFor={reasonId}>{t("orderDetail.cancelReason")}</label>
        <textarea
          id={reasonId}
          name="reason"
          className="lm-inp lm-textarea"
          rows={2}
          maxLength={255}
        />
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        className="lm-btn ghost danger"
        onClick={() => setOpen(true)}
        data-testid="cancel-order"
      >
        {t("orderDetail.cancel")}
      </button>
      <noscript>
        <details className="lm-gift">
          <summary>{t("orderDetail.cancel")}</summary>
          <form action={cancelOrderForm}>
            {fields}
            <button type="submit" className="lm-btn primary sm">
              {t("orderDetail.cancelConfirm")}
            </button>
          </form>
        </details>
      </noscript>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-labelledby={titleId}
          className="gap-3 rounded-[18px] border border-line bg-surface p-5 text-ink ring-0 sm:max-w-[400px]"
        >
          <DialogTitle
            id={titleId}
            className="font-display text-xl font-semibold"
          >
            {t("orderDetail.cancelTitle")}
          </DialogTitle>
          <DialogDescription className="text-ink-muted">
            {t("orderDetail.cancelText")}
          </DialogDescription>
          <form onSubmit={onSubmit}>
            <input type="hidden" name="js" value="1" />
            {fields}
            <div className="flex gap-2">
              <button
                type="submit"
                className="lm-btn primary sm"
                disabled={pending}
                aria-busy={pending}
              >
                {t("orderDetail.cancelConfirm")}
              </button>
              <DialogClose asChild>
                <button type="button" className="lm-btn ghost sm">
                  {t("orderDetail.keep")}
                </button>
              </DialogClose>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
