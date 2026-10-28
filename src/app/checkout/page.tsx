import type { Metadata } from "next";
import Link from "next/link";

import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import { Amount } from "@/components/shared/price";
import { beginCheckout, placeCheckout } from "@/features/checkout/actions";
import { CheckoutAddressForm } from "@/features/checkout/components/address-form";
import { verifyCheckoutFingerprint } from "@/features/checkout/fingerprint";
import { t } from "@/i18n";
import { getApi, unwrap } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/user";

export const metadata: Metadata = { title: t("pages.checkout") };
// Personal checkout data is intentionally rendered as a blocking request.
export const instant = false;

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ state?: string; address?: string }> }) {
  const user = await requireUser("/checkout");
  const query = await searchParams;
  const state = verifyCheckoutFingerprint(query.state ?? "");
  if (!user) return <PageChrome path="/checkout"><PageTitle>{t("pages.checkout")}</PageTitle></PageChrome>;
  const api = await getApi();
  const [addresses, governorates] = await Promise.all([
    unwrap(api.GET("/users/me/addresses")),
    unwrap(api.GET("/governorates")),
  ]);
  const selectedId = Number(query.address);
  const selectedAddress = addresses.find((address) => address.id === state?.addressId) ?? addresses.find((address) => address.id === selectedId) ?? addresses.find((address) => address.is_default) ?? addresses[0];
  const cart = await unwrap(api.GET("/cart", {
    params: { query: selectedAddress ? { governorate: selectedAddress.governorate } : {} },
  }));
  const selectedQuote = state ? cart.delivery_quotes.find((quote) => quote.code === state.deliveryMethodCode) : null;
  return (
    <PageChrome path="/checkout">
      <PageTitle>{t("pages.checkout")}</PageTitle>
      {state && selectedAddress && selectedQuote ? (
        <form action={placeCheckout} className="lm-summary">
          <input type="hidden" name="state" value={query.state} />
          <p>{selectedAddress.details}</p>
          <p>{selectedQuote.name}</p>
          <p>{selectedQuote.fee_paid_to_carrier ? "تُدفع لشركة الشحن عند الاستلام" : "الدفع عند الاستلام"}</p>
          {selectedQuote.totals.map((total) => <Amount key={total.currency} value={total.amount} currency={total.currency} />)}
          <textarea name="customer_notes" className="lm-inp" />
          <textarea name="gift_message" className="lm-inp" />
          <button className="lm-btn primary" type="submit">{t("cart.checkout")}</button>
        </form>
      ) : <>
        {addresses.length ? <section className="lm-summary"><h2>{t("checkout.address")}</h2>{addresses.map((address) => <Link className="lm-btn ghost" key={address.id} href={`/checkout?address=${address.id}`}>{address.label ?? address.details}{address.id === selectedAddress?.id ? " ✓" : ""}</Link>)}</section> : null}
        {selectedAddress ? <form action={beginCheckout} className="lm-summary">
          <input type="hidden" name="address_id" value={selectedAddress.id} />
          <h2>{t("checkout.delivery")}</h2>
          <select className="lm-inp" name="delivery_method_code">{cart.delivery_quotes.map((quote) => <option key={quote.code} value={quote.code}>{quote.name}{quote.fee_paid_to_carrier ? " — تُدفع لشركة الشحن عند الاستلام" : ""}</option>)}</select>
          <p>الدفع عند الاستلام</p>
          <button className="lm-btn primary" type="submit">{t("checkout.review")}</button>
        </form> : null}
        <CheckoutAddressForm governorates={governorates} />
      </>}
    </PageChrome>
  );
}
