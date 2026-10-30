"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { badgeStore } from "@/features/cart/badge-store";
import { flashToast, mergeFlash } from "@/features/cart/flash";
import { showToast } from "@/features/cart/toast";
import { t } from "@/i18n";

import { reorderOrder, reorderOrderForm } from "../actions";

/**
 * "إعادة الطلب": adds the order's items back to the cart (the backend's merge rules decide
 * what is added, capped or skipped), then shows the same toast the cart merge after login
 * shows, updates the cart badge and offers the cart. Without JavaScript it is a plain form
 * post that goes to the cart with that toast.
 */
export function ReorderButton({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("js", "1");
    startTransition(async () => {
      try {
        const result = await reorderOrder(data);
        if (!result.ok) {
          showToast({ text: result.message });
          return;
        }
        badgeStore.set({ cart: result.cartCount });
        const view = flashToast(
          mergeFlash(result.report.map((status) => ({ status }))),
        ) ?? { text: t("orderDetail.reorderNothing") };
        showToast(view, (href: Route) => router.push(href));
        setDone(true);
      } catch {
        showToast({ text: t("errors.generic") });
      }
    });
  };

  return (
    <>
      <form action={reorderOrderForm} onSubmit={onSubmit}>
        <input type="hidden" name="id" value={orderId} />
        <button
          type="submit"
          className="lm-btn ghost"
          disabled={pending}
          aria-busy={pending}
          data-testid="reorder"
        >
          {pending ? t("orderDetail.reordering") : t("orderDetail.reorder")}
        </button>
      </form>
      {done ? (
        <Link href="/cart" className="lm-link" data-testid="reorder-cart-link">
          {t("orderDetail.viewCart")}
        </Link>
      ) : null}
    </>
  );
}
