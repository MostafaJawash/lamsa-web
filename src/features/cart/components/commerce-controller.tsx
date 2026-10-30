"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  getFavoriteState,
  moveToCart,
  toggleFavorite,
} from "@/features/favorites/actions";
import { t } from "@/i18n";

import { badgeStore } from "../badge-store";
import { showPendingFlash } from "../flash-client";
import { cartErrorText } from "../lines";
import { showToast } from "../toast";

const HEART = 'form[data-lm-form="fav"] button[data-product-id]';

function hearts(productId?: string): HTMLButtonElement[] {
  const selector = productId
    ? `form[data-lm-form="fav"] button[data-product-id="${CSS.escape(productId)}"]`
    : HEART;
  return [...document.querySelectorAll<HTMLButtonElement>(selector)];
}

/**
 * The one client controller for hearts, favorites-page actions and flash toasts,
 * mounted once in the root layout (no client component per card):
 * - reads the visitor's favorite ids once per page view (server action) and marks the
 *   hearts (`aria-pressed`), including hearts that appear later (client navigation);
 * - takes over heart / "move to cart" / remove form submits (event delegation, capture
 *   phase, before React): flips every heart of that product at once (optimistic), calls
 *   the server action, reverts and shows the error on failure, shows the prototype
 *   toast, and updates the badges;
 * - shows a flash toast left by a redirect (login merge), once.
 */
export function CommerceController({ flash }: { flash: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const favorites = useRef<Set<string> | null>(null);
  const pending = useRef(new Set<string>());

  // A marker for tests (and anything else) that must wait until the page is interactive.
  useEffect(() => {
    document.documentElement.dataset.hydrated = "1";
  }, []);

  // Favorite ids, once per page view; mark hearts now and whenever new ones appear.
  useEffect(() => {
    let cancelled = false;
    const mark = () => {
      const ids = favorites.current;
      if (!ids) return;
      for (const button of hearts()) {
        const id = button.dataset.productId ?? "";
        if (pending.current.has(id)) continue;
        const pressed = String(ids.has(id));
        if (button.getAttribute("aria-pressed") !== pressed)
          button.setAttribute("aria-pressed", pressed);
      }
    };
    void getFavoriteState().then((state) => {
      if (cancelled || !state) return;
      favorites.current = new Set(state.ids.map(String));
      badgeStore.set({ favorites: state.ids.length });
      mark();
    });
    const main = document.getElementById("main") ?? document.body;
    const observer = new MutationObserver(mark);
    observer.observe(main, { childList: true, subtree: true });
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [pathname]);

  // Flash toast (cookie set by a server action before a redirect, or handed over by the proxy).
  useEffect(() => {
    showPendingFlash(flash, (href) => router.push(href));
  }, [pathname, flash, router]);

  // Form submits: hearts, "move to cart", remove from favorites.
  useEffect(() => {
    const navigate = (href: Route) => router.push(href);

    async function onFavorite(form: HTMLFormElement, want?: boolean) {
      const button = form.querySelector<HTMLButtonElement>("[data-product-id]");
      const id =
        button?.dataset.productId ??
        String(new FormData(form).get("product_id") ?? "");
      if (!id || pending.current.has(id)) return;
      const on = want ?? button?.getAttribute("aria-pressed") !== "true";
      const before = hearts(id).map(
        (b) => [b, b.getAttribute("aria-pressed")] as const,
      );
      pending.current.add(id);
      for (const [b] of before) b.setAttribute("aria-pressed", String(on));
      const undoBadge = badgeStore.add("favorites", on ? 1 : -1);
      const data = new FormData(form);
      data.set("product_id", id);
      data.set("want", on ? "1" : "0");
      data.set("js", "1");
      try {
        const result = await toggleFavorite(data);
        if (!result.ok) throw result.error;
        if (on) favorites.current?.add(id);
        else favorites.current?.delete(id);
        badgeStore.set(result.counts);
        showToast(
          on
            ? {
                text: t("toast.favAdded"),
                action: { label: t("toast.favAction"), href: "/favorites" },
              }
            : { text: t("toast.favRemoved") },
          navigate,
        );
      } catch (error) {
        for (const [b, value] of before)
          b.setAttribute("aria-pressed", value ?? "false");
        undoBadge();
        showToast({
          text:
            typeof error === "object" && error && "code" in error
              ? cartErrorText(error as Parameters<typeof cartErrorText>[0])
              : t("errors.generic"),
        });
      } finally {
        pending.current.delete(id);
      }
    }

    async function onMove(form: HTMLFormElement) {
      const data = new FormData(form);
      const id = String(data.get("product_id") ?? "");
      if (!id || pending.current.has(id)) return;
      pending.current.add(id);
      data.set("js", "1");
      try {
        const result = await moveToCart(data);
        if (!result.ok) {
          showToast({ text: cartErrorText(result.error) });
          return;
        }
        favorites.current?.delete(id);
        badgeStore.set(result.counts);
        showToast(
          {
            text: t("toast.moved"),
            action: { label: t("toast.movedAction"), href: "/cart" },
          },
          navigate,
        );
      } catch {
        showToast({ text: t("errors.generic") });
      } finally {
        pending.current.delete(id);
      }
    }

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const kind = form.dataset.lmForm;
      if (kind !== "fav" && kind !== "unfav" && kind !== "move") return;
      // Ours, not React's: stop before React's root listener runs the form action.
      event.preventDefault();
      event.stopPropagation();
      if (kind === "move") void onMove(form);
      else void onFavorite(form, kind === "unfav" ? false : undefined);
    };
    window.addEventListener("submit", onSubmit, { capture: true });
    return () =>
      window.removeEventListener("submit", onSubmit, { capture: true });
  }, [router]);

  return null;
}
