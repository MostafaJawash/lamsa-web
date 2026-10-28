import type { Metadata } from "next";

import { PageChrome } from "@/components/layout/page-chrome";
import { PageTitle } from "@/components/layout/page-title";
import { Amount } from "@/components/shared/price";
import { t } from "@/i18n";
import { getApi, unwrap } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/user";

export const metadata: Metadata = { title: t("pages.checkoutSuccess") };
export const instant = false;

export default async function CheckoutSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/checkout/success/${id}`);
  const orderId = Number(id);
  if (!user || !Number.isSafeInteger(orderId) || orderId < 1) {
    return <PageChrome path="/checkout/success/[id]"><PageTitle>{t("pages.checkoutSuccess")}</PageTitle></PageChrome>;
  }
  const api = await getApi();
  const order = await unwrap(api.GET("/orders/{order_id}", { params: { path: { order_id: orderId } } }));
  return (
    <PageChrome path="/checkout/success/[id]">
      <PageTitle>{t("pages.checkoutSuccess")}</PageTitle>
      <section className="lm-summary">
        <p>{t("checkout.orderNumber", { id: order.id })}</p>
        <p>{order.delivery.name}</p>
        {order.totals.map((total) => <Amount key={total.currency} value={total.total} currency={total.currency as "SYP" | "USD"} />)}
      </section>
    </PageChrome>
  );
}
