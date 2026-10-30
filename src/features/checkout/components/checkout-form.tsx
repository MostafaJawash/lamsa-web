"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  createContext,
  useActionState,
  useContext,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { t } from "@/i18n";

import type { CheckoutState } from "../actions";
import { checkoutHref } from "../links";

export const CHECKOUT_FORM_ID = "checkout-form";
const NOTE_MAX = 500;

type Context = { pending: boolean };
const CheckoutContext = createContext<Context>({ pending: false });

type Props = {
  /** `placeOrder`. */
  action: (previous: CheckoutState, form: FormData) => Promise<CheckoutState>;
  /** The id of this rendering of the page, i.e. of this checkout attempt (attempt.ts). */
  attempt: string;
  /** The per-currency totals shown on this page, as JSON (totals.ts). */
  expectedTotals: string;
  /** The failure of a plain (no JavaScript) post, handed back by the server. */
  initialState: CheckoutState;
  /** The two columns of the page (boxes, summary), all server-rendered. */
  children: React.ReactNode;
};

/**
 * The checkout form. The `<form>` element is empty on purpose: the controls sit in the
 * server-rendered boxes and point at it with the `form` attribute, so the inline address
 * form in box 1 is a separate, non-nested form.
 *
 * Without JavaScript it is a normal form post (see actions.ts; the "تحديث" button
 * re-renders the page for another address or method). With JavaScript, picking another
 * address or method re-renders the server page at once (soft navigation) so the methods,
 * fees and totals always come from the backend, and the submit shows a pending state
 * and cannot be sent twice.
 */
export function CheckoutForm({
  action,
  attempt,
  expectedTotals,
  initialState,
  children,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);
  // Set once JavaScript runs: the action then returns its failure instead of redirecting.
  const scripted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [refreshing, startTransition] = useTransition();

  const onChange = (event: React.ChangeEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) ||
      (target.name !== "address_id" && target.name !== "method")
    )
      return;
    const form = document.getElementById(CHECKOUT_FORM_ID);
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    const address = Number(data.get("address_id")) || null;
    const method = String(data.get("method") ?? "") || null;
    startTransition(() => {
      router.replace(
        checkoutHref({
          address,
          method,
          notes: String(data.get("customer_notes") ?? ""),
          gift: String(data.get("gift_message") ?? ""),
        }) as Route,
        { scroll: false },
      );
    });
  };

  return (
    <CheckoutContext value={{ pending }}>
      <form id={CHECKOUT_FORM_ID} action={formAction} data-checkout-form>
        {scripted ? <input type="hidden" name="js" value="1" /> : null}
        <input type="hidden" name="attempt" value={attempt} />
        <input type="hidden" name="expected_totals" value={expectedTotals} />
      </form>
      {state ? (
        <p
          className="lm-err lm-co-error"
          role="alert"
          data-testid="checkout-error"
        >
          {state.message}
        </p>
      ) : null}
      <div
        className="lm-co-grid"
        data-busy={refreshing || pending ? "true" : "false"}
        onChange={onChange}
      >
        {children}
      </div>
    </CheckoutContext>
  );
}

/** The submit button, outside the form element (it points at it); disabled while pending. */
export function PlaceOrderButton({
  disabled,
  describedBy,
}: {
  disabled: boolean;
  describedBy?: string;
}) {
  const { pending } = useContext(CheckoutContext);
  return (
    <button
      type="submit"
      form={CHECKOUT_FORM_ID}
      className="lm-btn primary w-full"
      disabled={disabled || pending}
      aria-busy={pending}
      aria-describedby={describedBy}
      data-testid="place-order"
    >
      {pending ? t("checkout.confirming") : t("checkout.confirm")}
    </button>
  );
}

/** Notes and the collapsible gift message of box 4, both bounded like the backend's. */
export function NotesFields({
  initialNotes,
  initialGift,
}: {
  initialNotes: string;
  initialGift: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [gift, setGift] = useState(initialGift);
  return (
    <>
      <div className="lm-fld">
        <label htmlFor="co-notes">{t("checkout.notes")}</label>
        <textarea
          id="co-notes"
          form={CHECKOUT_FORM_ID}
          name="customer_notes"
          className="lm-inp lm-textarea"
          rows={2}
          maxLength={NOTE_MAX}
          placeholder={t("checkout.notesPlaceholder")}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <span className="lm-hint lm-num" dir="ltr">
          {t("addressForm.counter", { n: [...notes].length, max: NOTE_MAX })}
        </span>
      </div>
      <details className="lm-gift" open={initialGift.trim() !== ""}>
        <summary>{t("checkout.gift")}</summary>
        <div className="lm-fld">
          <label htmlFor="co-gift">{t("checkout.giftLabel")}</label>
          <textarea
            id="co-gift"
            form={CHECKOUT_FORM_ID}
            name="gift_message"
            className="lm-inp lm-textarea"
            rows={2}
            maxLength={NOTE_MAX}
            placeholder={t("checkout.giftPlaceholder")}
            value={gift}
            onChange={(event) => setGift(event.target.value)}
          />
          <span className="lm-hint lm-num" dir="ltr">
            {t("addressForm.counter", { n: [...gift].length, max: NOTE_MAX })}
          </span>
        </div>
      </details>
    </>
  );
}
