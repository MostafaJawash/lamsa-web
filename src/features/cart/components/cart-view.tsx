"use client";

import type { Route } from "next";
import Link from "next/link";
// clsx, not cn(): no tailwind-merge in the client bundle for static class lists.
import { clsx as cn } from "clsx";
import {
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";

import { BackendImage } from "@/components/shared/backend-image";
import { EmptyState } from "@/components/shared/empty-state";
import { BagIcon, XIcon } from "@/components/shared/icons";
import { Amount, Price } from "@/components/shared/price";
import { ProductSilhouette } from "@/components/shared/product-art";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/i18n";
import { addMoney, pluralize } from "@/lib/format";

import {
  clearCart,
  removeLine,
  removeLineForm,
  resolveIssues,
  updateLine,
} from "../actions";
import { badgeStore } from "../badge-store";
import {
  cartErrorText,
  homeQuote,
  issueText,
  lineKey,
  lineRef,
} from "../lines";
import { showToast } from "../toast";
import type { AnyCart, AnyCartLine, CartActionResult } from "../types";

const DEBOUNCE_MS = 300;
const MAX_QUANTITY = 99;

type Change =
  | { type: "quantity"; ref: string; quantity: number }
  | { type: "remove"; ref: string }
  | { type: "clear" };

function applyChange(cart: AnyCart, change: Change): AnyCart {
  if (change.type === "clear") return { ...cart, lines: [] } as AnyCart;
  const lines = cart.lines.flatMap((line) => {
    if (lineRef(line) !== change.ref) return [line];
    return change.type === "remove"
      ? []
      : [{ ...line, quantity: change.quantity }];
  });
  return { ...cart, lines } as AnyCart;
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

/** Prototype `.line` link: /p/<slug>, with ?v=<variant id> for a variant. */
function productHref(line: AnyCartLine): Route | null {
  if (!line.product.slug) return null;
  const base = `/p/${encodeURIComponent(line.product.slug)}`;
  return (line.variant ? `${base}?v=${line.variant.id}` : base) as Route;
}

/**
 * The cart page (prototype `pCart()`): the ONE client component of the page, holding
 * the CartOut (logged in) or the guest preview, both rendered the same way.
 *
 * State: `server` is the last cart the backend computed (from props, or from the last
 * action). Quantity changes are optimistic (useOptimistic), debounced per line (300 ms
 * in `drafts`), and every action returns the new cart, which replaces `server`: totals
 * are never computed here (the summary dims while anything is pending). Server actions
 * run one at a time, in order, so the last answer is the newest state. An error reverts
 * only that line and shows the message under it.
 */
export function CartView({ initial }: { initial: AnyCart }) {
  const fixId = useId();
  const [server, setServer] = useState(initial);
  const [seen, setSeen] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const [pending, startTransition] = useTransition();
  const [cart, change] = useOptimistic(server, applyChange);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // A guest change sets a cookie, so Next.js re-renders the page: take the new props,
  // unless a change of ours is still on its way (its own answer will follow).
  if (initial !== seen) {
    setSeen(initial);
    if (!pending && Object.keys(drafts).length === 0) setServer(initial);
  }

  useEffect(() => {
    badgeStore.set({ cart: server.items_count });
  }, [server.items_count]);

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      for (const timer of pendingTimers.values()) clearTimeout(timer);
    };
  }, []);

  const apply = (result: CartActionResult, ref: string | null) => {
    if (result.ok) {
      if (result.cart) setServer(result.cart);
      badgeStore.set(result.counts);
      if (ref) setLineErrors((errors) => without(errors, ref));
      if (result.notices?.length)
        showToast({ text: [...new Set(result.notices)].join("، ") });
      return;
    }
    const message = cartErrorText(result.error);
    if (ref) setLineErrors((errors) => ({ ...errors, [ref]: message }));
    showToast({ text: message });
  };

  const commit = (ref: string, quantity: number) => {
    setDrafts((current) => without(current, ref));
    startTransition(async () => {
      change({ type: "quantity", ref, quantity });
      try {
        apply(await updateLine({ line: ref, quantity }), ref);
      } catch {
        apply(
          {
            ok: false,
            error: {
              code: "UNKNOWN_ERROR",
              message: t("errors.generic"),
              available: null,
              max: null,
            },
          },
          ref,
        );
      }
    });
  };

  const remove = (ref: string, form: FormData) => {
    const timer = timers.current.get(ref);
    if (timer) clearTimeout(timer);
    setDrafts((current) => without(current, ref));
    form.set("js", "1");
    startTransition(async () => {
      change({ type: "remove", ref });
      try {
        apply(await removeLine(form), ref);
      } catch {
        showToast({ text: t("errors.generic") });
      }
    });
  };

  const step = (line: AnyCartLine, delta: number) => {
    const ref = lineRef(line);
    const current = drafts[ref] ?? line.quantity;
    const quantity = Math.min(current + delta, MAX_QUANTITY);
    if (quantity < 1) {
      // Prototype: "−" at 1 removes the line.
      const form = new FormData();
      form.set("line", ref);
      remove(ref, form);
      return;
    }
    setDrafts((drafted) => ({ ...drafted, [ref]: quantity }));
    const timer = timers.current.get(ref);
    if (timer) clearTimeout(timer);
    timers.current.set(
      ref,
      setTimeout(() => {
        timers.current.delete(ref);
        commit(ref, quantity);
      }, DEBOUNCE_MS),
    );
  };

  const run = (action: () => Promise<CartActionResult>, clear = false) =>
    startTransition(async () => {
      if (clear) change({ type: "clear" });
      try {
        apply(await action(), null);
      } catch {
        showToast({ text: t("errors.generic") });
      }
    });

  const busy = pending || Object.keys(drafts).length > 0;

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        icon={<BagIcon />}
        title={t("cart.emptyTitle")}
        text={t("cart.emptyText")}
        action={
          <Link href="/" className="lm-btn primary">
            {t("cart.startShopping")}
          </Link>
        }
      />
    );
  }

  const quote = homeQuote(server);
  const freeFrom = quote?.free_from ?? null;
  const toFree = quote?.amount_to_free_shipping ?? null;
  const progress =
    freeFrom && Number(freeFrom) > 0
      ? Math.min(100, (Number(server.subtotal) / Number(freeFrom)) * 100)
      : 100;
  const [beforeAmount, afterAmount] = t("cart.toFree").split("{amount}");

  return (
    <>
      <div className="lm-list-head">
        <h1>{t("pages.cart")}</h1>
        <span className="lm-count">
          {pluralize(server.items_count, "items")}
        </span>
      </div>
      <div className="lm-cart-grid">
        <div>
          {server.issues_count > 0 ? (
            <div className="lm-cart-notice" role="status">
              <span>{t("cart.issuesNotice")}</span>
              <button
                type="button"
                className="lm-btn primary sm"
                disabled={pending}
                onClick={() => run(resolveIssues)}
              >
                {t("cart.resolve")}
              </button>
            </div>
          ) : null}
          <div aria-label={t("cart.lines")} role="list">
            {cart.lines.map((line) => {
              const ref = lineRef(line);
              const href = productHref(line);
              const quantity = drafts[ref] ?? line.quantity;
              const error = line.issue
                ? issueText(line.issue)
                : lineErrors[ref];
              const variant = [line.product.brand?.name, line.variant?.label]
                .filter(Boolean)
                .join("، ");
              const name = line.product.name || t("cart.unknownProduct");
              return (
                <div
                  key={lineKey(line)}
                  role="listitem"
                  className={cn("lm-line", line.issue && "out")}
                  data-line={lineKey(line)}
                >
                  <span className="lm-art">
                    <ProductSilhouette />
                    {line.image ? (
                      <BackendImage urls={line.image} alt="" sizes="76px" />
                    ) : null}
                  </span>
                  <div className="l-info">
                    {href ? (
                      <Link href={href} className="l-name">
                        {name}
                      </Link>
                    ) : (
                      <span className="l-name">{name}</span>
                    )}
                    {variant ? <span className="l-var">{variant}</span> : null}
                    {href ? (
                      <span className="l-price">
                        <Price
                          price={line.unit_price}
                          compareAt={line.compare_at_price}
                        />
                      </span>
                    ) : null}
                    {error ? (
                      <p className="lm-err" role="alert">
                        {error}
                      </p>
                    ) : null}
                  </div>
                  <div
                    className="lm-qty sm"
                    role="group"
                    aria-label={`${t("product.quantity")}: ${name}`}
                  >
                    <button
                      type="button"
                      aria-label={t("product.less")}
                      onClick={() => step(line, -1)}
                    >
                      −
                    </button>
                    <span aria-live="polite">{quantity}</span>
                    <button
                      type="button"
                      aria-label={t("product.more")}
                      disabled={quantity >= MAX_QUANTITY}
                      onClick={() => step(line, 1)}
                    >
                      +
                    </button>
                  </div>
                  <form
                    action={removeLineForm}
                    onSubmit={(event) => {
                      event.preventDefault();
                      remove(ref, new FormData(event.currentTarget));
                    }}
                  >
                    <input type="hidden" name="line" value={ref} />
                    <input type="hidden" name="next" value="/cart" />
                    <button
                      type="submit"
                      className="l-rm"
                      aria-label={`${t("cart.remove")}: ${name}`}
                    >
                      <XIcon />
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="lm-link lm-cart-clear"
            onClick={() => setConfirmClear(true)}
          >
            {t("cart.clear")}
          </button>
        </div>

        <aside className="lm-summary" aria-busy={busy}>
          <h2>{t("cart.summary")}</h2>
          <div className="lm-row">
            <span>{t("cart.subtotal")}</span>
            <Amount value={server.subtotal} />
          </div>
          {quote ? (
            <div className="lm-row">
              <span>{t("cart.homeShipping")}</span>
              {quote.is_free ? (
                <b className="free">{t("cart.free")}</b>
              ) : (
                <Amount value={quote.fee} />
              )}
            </div>
          ) : null}
          {freeFrom ? (
            toFree ? (
              <>
                <div className="lm-freebar">
                  <div style={{ width: `${progress}%` }} />
                </div>
                <p className="lm-hint">
                  {beforeAmount}
                  <Amount value={toFree} />
                  {afterAmount}
                </p>
              </>
            ) : (
              <p className="lm-hint ok">{t("cart.freeReached")}</p>
            )
          ) : null}
          {Number(server.savings) > 0 ? (
            <div className="lm-row">
              <span>{t("cart.savings")}</span>
              <Amount value={server.savings} />
            </div>
          ) : null}
          <div className="lm-row total">
            <span>{t("cart.total")}</span>
            <Amount value={addMoney(server.subtotal, quote?.fee ?? "0.00")} />
          </div>
          {server.can_checkout ? (
            <Link href="/checkout" className="lm-btn primary w-full">
              {t("cart.checkout")}
            </Link>
          ) : (
            <>
              <button
                type="button"
                className="lm-btn primary w-full"
                disabled
                aria-describedby={fixId}
              >
                {t("cart.checkout")}
              </button>
              <p className="lm-hint" id={fixId}>
                {t("cart.fixFirst")}
              </p>
            </>
          )}
          <p className="lm-hint">{t("cart.checkoutHint")}</p>
        </aside>
      </div>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="gap-3 rounded-[18px] border border-line bg-surface p-5 text-ink ring-0 sm:max-w-[380px]">
          <DialogTitle className="font-display text-xl font-semibold">
            {t("cart.clearTitle")}
          </DialogTitle>
          <DialogDescription className="text-ink-muted">
            {t("cart.clearText")}
          </DialogDescription>
          <div className="flex gap-2">
            <button
              type="button"
              className="lm-btn primary sm"
              onClick={() => {
                setConfirmClear(false);
                run(clearCart, true);
              }}
            >
              {t("cart.clearConfirm")}
            </button>
            <DialogClose asChild>
              <button type="button" className="lm-btn ghost sm">
                {t("cart.cancel")}
              </button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
