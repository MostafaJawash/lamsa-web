import { PageFlash } from "@/features/cart/components/page-flash";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageChrome } from "@/components/layout/page-chrome";
import { EmptyState } from "@/components/shared/empty-state";
import { BagIcon } from "@/components/shared/icons";
import type { AddressFormState } from "@/features/account/actions";
import { placeOrder, type CheckoutState } from "@/features/checkout/actions";
import { newAttemptId } from "@/features/checkout/attempt";
import {
  AddressBox,
  DeliveryBox,
  PaymentBox,
  Summary,
} from "@/features/checkout/components/checkout-boxes";
import {
  CheckoutForm,
  NotesFields,
} from "@/features/checkout/components/checkout-form";
import {
  isCheckoutNotice,
  type CheckoutNotice,
} from "@/features/checkout/links";
import { getCheckoutData } from "@/features/checkout/queries";
import { serializeTotals } from "@/features/checkout/totals";
import { t } from "@/i18n";
import { requireUser } from "@/lib/auth/user";
import { readFailure } from "@/lib/form-failure";

/**
 * Personal and always fresh: rendered in full per request, like /cart (a blocking route,
 * so it works without JavaScript and never shows stale prices or methods).
 */
export const instant = false;

export const metadata: Metadata = {
  title: t("pages.checkout"),
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function intParam(value: string): number | null {
  return /^\d{1,9}$/.test(value) ? Number(value) : null;
}

const NOTICE_TEXT: Record<CheckoutNotice, () => string> = {
  price: () => t("checkout.priceChanged"),
  method: () => t("checkout.methodChanged"),
  address: () => t("checkout.addressInvalid"),
  location: () => t("apiErrors.INVALID_LOCATION"),
};

/** Checkout (prototype `pCheckout()`): address, delivery, payment, notes, and the summary. */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser("/checkout");
  const params = await searchParams;
  const unavailable = (
    <PageChrome path="/checkout">
      <div className="lm-list-head">
        <h1>{t("pages.checkout")}</h1>
      </div>
      <EmptyState icon={<BagIcon />} title={t("checkout.unavailable")} />
    </PageChrome>
  );
  if (!user) return unavailable;

  const methodParam = one(params.method);
  const data = await getCheckoutData({
    addressId: intParam(one(params.address)),
    method: /^[a-z0-9_]{1,30}$/.test(methodParam) ? methodParam : null,
  });
  if (data.status === "unavailable") return unavailable;
  // Empty cart, or a cart with issues: /cart shows what to fix.
  if (data.status === "cart") redirect("/cart");

  const { cart, addresses, governorates, address, quotes, quote } = data;
  const noticeParam = one(params.notice);
  const notice = isCheckoutNotice(noticeParam) ? noticeParam : null;
  const canPlace = address !== null && quote !== null;
  // The failure of a plain (no JavaScript) post, handed back by the server (`?fs=`).
  const failure = readFailure<CheckoutState | AddressFormState>(params.fs);
  const orderFailure =
    failure && "message" in failure ? (failure as CheckoutState) : null;
  const addressFailure =
    failure && "errors" in failure ? (failure as AddressFormState) : null;
  const hint =
    address === null
      ? t("checkout.needAddress")
      : quote === null
        ? t("checkout.needMethod")
        : null;

  return (
    <PageChrome path="/checkout">
      <div className="lm-list-head">
        <h1>{t("pages.checkout")}</h1>
      </div>
      {notice ? (
        <div
          className="lm-cart-notice"
          role="alert"
          data-testid="checkout-notice"
        >
          <span>{NOTICE_TEXT[notice]()}</span>
        </div>
      ) : null}
      <PageFlash />
      <CheckoutForm
        action={placeOrder}
        attempt={newAttemptId()}
        expectedTotals={quote ? serializeTotals(quote.totals) : ""}
        initialState={orderFailure}
      >
        <div>
          <AddressBox
            addresses={addresses}
            governorates={governorates}
            selected={address}
            method={quote?.code ?? null}
            adding={one(params.new) !== ""}
            addressFailure={addressFailure}
          />
          <DeliveryBox
            hasAddress={address !== null}
            quotes={quotes}
            selected={quote}
          />
          <PaymentBox />
          <section className="lm-box" aria-labelledby="co-notes-title">
            <h2 className="lm-box-title">
              <i>4</i>
              <span id="co-notes-title">{t("checkout.extras")}</span>
            </h2>
            <NotesFields
              initialNotes={(orderFailure?.notes ?? one(params.notes)).slice(
                0,
                500,
              )}
              initialGift={(orderFailure?.gift ?? one(params.gift)).slice(
                0,
                500,
              )}
            />
          </section>
        </div>
        <Summary cart={cart} quote={quote} canPlace={canPlace} hint={hint} />
      </CheckoutForm>
    </PageChrome>
  );
}
