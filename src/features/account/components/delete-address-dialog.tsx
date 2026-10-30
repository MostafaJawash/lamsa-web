"use client";

import { useEffect, useId, useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/i18n";

import { deleteAddress } from "../actions";

type Target = { id: string; label: string };

/**
 * One confirmation dialog for the whole address list (not one per card). The "حذف" links
 * are plain links to `?delete=<id>`, which the page answers with a server-rendered
 * confirmation, so deleting works without JavaScript; with JavaScript this component
 * intercepts the click (event delegation, like the commerce controller) and opens the
 * dialog instead.
 */
export function DeleteAddressDialog() {
  const [target, setTarget] = useState<Target | null>(null);
  const titleId = useId();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        !(event.target instanceof Element)
      )
        return;
      const link = event.target.closest<HTMLElement>("[data-delete-address]");
      if (!link) return;
      const id = link.dataset.deleteAddress;
      if (!id) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget({ id, label: link.dataset.label ?? "" });
    };
    // Capture phase: before the router's own link handling.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) setTarget(null);
      }}
    >
      <DialogContent
        aria-labelledby={titleId}
        className="gap-3 rounded-[18px] border border-line bg-surface p-5 text-ink ring-0 sm:max-w-[380px]"
      >
        <DialogTitle
          id={titleId}
          className="font-display text-xl font-semibold"
        >
          {t("addresses.deleteTitle")}
        </DialogTitle>
        <DialogDescription className="text-ink-muted">
          {target?.label
            ? t("addresses.deleteTextNamed", { label: target.label })
            : t("addresses.deleteText")}
        </DialogDescription>
        <form action={deleteAddress} className="flex gap-2">
          <input type="hidden" name="id" value={target?.id ?? ""} />
          <button type="submit" className="lm-btn primary sm">
            {t("addresses.deleteConfirm")}
          </button>
          <DialogClose asChild>
            <button type="button" className="lm-btn ghost sm">
              {t("addresses.cancel")}
            </button>
          </DialogClose>
        </form>
      </DialogContent>
    </Dialog>
  );
}
