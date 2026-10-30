import type { Route } from "next";
import Link from "next/link";

import { BackendImage } from "@/components/shared/backend-image";
import { CashIcon } from "@/components/shared/icons";
import { Amount, Amounts } from "@/components/shared/price";
import { ProductSilhouette } from "@/components/shared/product-art";
import { saveAddress, type AddressFormState } from "@/features/account/actions";
import { AddressForm } from "@/features/account/components/address-form";
import { governorateName } from "@/features/account/queries";
import type { Address, Governorate } from "@/features/account/types";
import type { Cart, DeliveryQuote } from "@/features/cart/types";
import { t } from "@/i18n";

import { checkoutHref } from "../links";
import { CHECKOUT_FORM_ID, PlaceOrderButton } from "./checkout-form";

/** The "تحديث" button of the no-JavaScript form: re-renders for another address or method. */
function RefreshButton() {
  return (
    <noscript>
      <button
        type="submit"
        form={CHECKOUT_FORM_ID}
        name="intent"
        value="refresh"
        formNoValidate
        className="lm-btn ghost sm"
      >
        {t("checkout.refresh")}
      </button>
    </noscript>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="lm-box-title">
      <i>{n}</i>
      {children}
    </h2>
  );
}

/** Box 1, prototype `.box` with `.radio` cards: saved addresses, and the inline new-address form. */
export function AddressBox({
  addresses,
  governorates,
  selected,
  method,
  adding,
  addressFailure,
}: {
  addresses: readonly Address[];
  governorates: readonly Governorate[];
  selected: Address | null;
  method: string | null;
  adding: boolean;
  /** The failure of a plain (no JavaScript) post of the address form. */
  addressFailure: AddressFormState;
}) {
  const showForm = adding || addresses.length === 0;
  return (
    <section className="lm-box" aria-labelledby="co-address-title">
      <Step n={1}>
        <span id="co-address-title">{t("checkout.address")}</span>
      </Step>
      {addresses.length > 0 ? (
        <div
          key={`address-${selected?.id ?? 0}`}
          role="radiogroup"
          aria-label={t("checkout.address")}
        >
          {addresses.map((address) => (
            <label className="lm-radio" key={address.id}>
              <input
                type="radio"
                name="address_id"
                form={CHECKOUT_FORM_ID}
                value={address.id}
                defaultChecked={address.id === selected?.id}
              />
              <span>
                <b>
                  {address.label?.trim() ||
                    governorateName(governorates, address.governorate)}
                  {address.is_default ? (
                    <span className="lm-badge-default">
                      {t("addresses.default")}
                    </span>
                  ) : null}
                </b>
                <small>
                  {[
                    governorateName(governorates, address.governorate),
                    address.area,
                  ]
                    .filter(Boolean)
                    .join("، ")}
                </small>
                <small>{address.details}</small>
              </span>
            </label>
          ))}
          <RefreshButton />
        </div>
      ) : (
        <p className="lm-hint">{t("checkout.noAddress")}</p>
      )}
      {showForm ? (
        <div className="lm-addr-panel" data-testid="checkout-address-form">
          {governorates.length > 0 ? (
            <AddressForm
              action={saveAddress}
              governorates={governorates}
              initialState={addressFailure}
              returnTo="checkout"
              submitLabel={t("addressForm.save")}
              cancelHref={
                addresses.length > 0
                  ? (checkoutHref({
                      address: selected?.id,
                      method,
                    }) as Route)
                  : undefined
              }
            />
          ) : (
            <p className="lm-err">{t("addresses.governoratesUnavailable")}</p>
          )}
        </div>
      ) : (
        <Link
          className="lm-link"
          href={
            checkoutHref({
              address: selected?.id,
              method,
              newAddress: true,
            }) as Route
          }
        >
          {t("checkout.addAddress")}
        </Link>
      )}
    </section>
  );
}

/** What a method costs, in its own currency, or the backend's carrier-paid note. */
function FeeText({ quote }: { quote: DeliveryQuote }) {
  if (quote.fee_paid_to_carrier)
    return <span className="fee">{t("checkout.paidToCarrier")}</span>;
  if (quote.is_free) return <span className="fee free">{t("cart.free")}</span>;
  return (
    <span className="fee">
      <Amount value={quote.fee} currency={quote.currency} />
    </span>
  );
}

/** Box 2: the methods the backend says are valid for the selected address. */
export function DeliveryBox({
  hasAddress,
  quotes,
  selected,
}: {
  hasAddress: boolean;
  quotes: readonly DeliveryQuote[];
  selected: DeliveryQuote | null;
}) {
  return (
    <section className="lm-box" aria-labelledby="co-delivery-title">
      <Step n={2}>
        <span id="co-delivery-title">{t("checkout.delivery")}</span>
      </Step>
      {!hasAddress ? (
        <p className="lm-hint">{t("checkout.deliveryNeedsAddress")}</p>
      ) : quotes.length === 0 ? (
        <p className="lm-err" role="status">
          {t("checkout.noMethods")}
        </p>
      ) : (
        <div
          key={`method-${selected?.code ?? "none"}-${quotes.map((q) => q.code).join(",")}`}
          role="radiogroup"
          aria-label={t("checkout.delivery")}
        >
          {quotes.map((quote) => (
            <label className="lm-radio" key={quote.code}>
              <input
                type="radio"
                name="method"
                form={CHECKOUT_FORM_ID}
                value={quote.code}
                defaultChecked={quote.code === selected?.code}
              />
              <span>
                <b>{quote.name}</b>
                {quote.description ? <small>{quote.description}</small> : null}
              </span>
              <FeeText quote={quote} />
            </label>
          ))}
          <RefreshButton />
        </div>
      )}
    </section>
  );
}

/** Box 3: cash on delivery, a fixed display (the only payment method). */
export function PaymentBox() {
  return (
    <section className="lm-box" aria-labelledby="co-payment-title">
      <Step n={3}>
        <span id="co-payment-title">{t("checkout.payment")}</span>
      </Step>
      <div className="lm-radio on lm-readonly" data-testid="payment-cod">
        <span>
          <b>{t("checkout.cod")}</b>
          <small>{t("checkout.codHint")}</small>
        </span>
        <CashIcon />
      </div>
    </section>
  );
}

/**
 * The order summary (prototype `.summary`): the lines, the per-currency subtotals, what the
 * chosen method adds (in its own currency, or the carrier-paid note) and the per-currency
 * totals. The totals are the backend's (the quote's `totals`), never added up here.
 */
export function Summary({
  cart,
  quote,
  canPlace,
  hint,
}: {
  cart: Cart;
  quote: DeliveryQuote | null;
  canPlace: boolean;
  /** Why the button is disabled. */
  hint: string | null;
}) {
  const totals = quote ? quote.totals : cart.subtotals;
  return (
    <aside className="lm-summary" aria-label={t("checkout.yourOrder")}>
      <h2>{t("checkout.yourOrder")}</h2>
      <div role="list">
        {cart.lines.map((line) => (
          <div className="lm-mini" role="listitem" key={`${line.id}`}>
            <span className="lm-art">
              <ProductSilhouette />
              {line.image ? (
                <BackendImage urls={line.image} alt="" sizes="44px" />
              ) : null}
            </span>
            <span>
              {line.product.name}
              {line.variant ? (
                <>
                  <br />
                  <small className="lm-muted">{line.variant.label}</small>
                </>
              ) : null}
            </span>
            <b className="lm-num" dir="ltr">
              ×{line.quantity}
            </b>
            <Amount value={line.line_total} currency={line.currency} />
          </div>
        ))}
      </div>
      <div className="lm-row" style={{ marginTop: 8 }}>
        <span>{t("cart.subtotal")}</span>
        <Amounts items={cart.subtotals} />
      </div>
      {cart.savings.length > 0 ? (
        <div className="lm-row">
          <span>{t("cart.savings")}</span>
          <Amounts items={cart.savings} />
        </div>
      ) : null}
      <div className="lm-row" data-testid="delivery-row">
        <span>{quote?.name ?? t("checkout.delivery")}</span>
        {quote ? (
          quote.fee_paid_to_carrier ? (
            <span className="lm-carrier-note">
              {quote.description || t("checkout.carrierPaid")}
            </span>
          ) : quote.is_free ? (
            <b className="free">{t("cart.free")}</b>
          ) : (
            <Amount value={quote.fee} currency={quote.currency} />
          )
        ) : (
          <span className="lm-muted">{t("checkout.deliveryPending")}</span>
        )}
      </div>
      <div className="lm-row total" data-testid="totals">
        <span>{t("cart.total")}</span>
        <Amounts items={totals} />
      </div>
      <PlaceOrderButton
        disabled={!canPlace}
        describedBy={hint ? "co-hint" : undefined}
      />
      {hint ? (
        <p className="lm-hint" id="co-hint">
          {hint}
        </p>
      ) : null}
      <p className="lm-hint">{t("checkout.notifyHint")}</p>
    </aside>
  );
}
