import type { Metadata } from "next";

import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import { Amount } from "@/components/shared/price";
import { beginCheckout, placeCheckout } from "@/features/checkout/actions";
import { verifyCheckoutFingerprint } from "@/features/checkout/fingerprint";
import { t } from "@/i18n";
import { getApi, unwrap } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/user";

export const metadata: Metadata = { title: t("pages.checkout") };
// Personal checkout data is intentionally rendered as a blocking request.
export const instant = false;

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const user = await requireUser("/checkout");
  const state = verifyCheckoutFingerprint((await searchParams).state ?? "");
  if (!user) return <PageChrome path="/checkout"><PageTitle>{t("pages.checkout")}</PageTitle></PageChrome>;
  const api = await getApi();
  const addresses = await unwrap(api.GET("/users/me/addresses"));
  const selectedAddress = addresses.find((address) => address.id === state?.addressId) ?? addresses.find((address) => address.is_default) ?? addresses[0];
  const cart = await unwrap(api.GET("/cart", {
    params: { query: selectedAddress ? { governorate: selectedAddress.governorate } : {} },
  }));
  const selectedQuote = state ? cart.delivery_quotes.find((quote) => quote.code === state.deliveryMethodCode) : null;
  return (
    <PageChrome path="/checkout">
      <PageTitle>{t("pages.checkout")}</PageTitle>
      {state && selectedAddress && selectedQuote ? (
        <form action={placeCheckout} className="lm-summary">
          <input type="hidden" name="state" value={(await searchParams).state} />
          <p>{selectedAddress.details}</p>
          <p>{selectedQuote.name}</p>
          {selectedQuote.totals.map((total) => <Amount key={total.currency} value={total.amount} currency={total.currency} />)}
          <textarea name="customer_notes" className="lm-inp" />
          <textarea name="gift_message" className="lm-inp" />
          <button className="lm-btn primary" type="submit">{t("cart.checkout")}</button>
        </form>
      ) : addresses.length ? (
        <form action={beginCheckout} className="lm-summary">
          <label>{t("checkout.address")}<select name="address_id" defaultValue={selectedAddress?.id}>{addresses.map((address) => <option key={address.id} value={address.id}>{address.label ?? address.details}</option>)}</select></label>
          <label>{t("checkout.delivery")}<select name="delivery_method_code">{cart.delivery_quotes.map((quote) => <option key={quote.code} value={quote.code}>{quote.name}</option>)}</select></label>
          <button className="lm-btn primary" type="submit">{t("checkout.review")}</button>
        </form>
      ) : <p>{t("checkout.noAddress")}</p>}
    </PageChrome>
  );
}
