import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageChrome } from "@/components/layout/page-chrome";
import { CheckIcon } from "@/components/shared/icons";
import { Amounts } from "@/components/shared/price";
import { CartEmptied } from "@/features/orders/components/cart-emptied";
import { getOrder, parseOrderId } from "@/features/orders/queries";
import { t } from "@/i18n";
import { requireUser } from "@/lib/auth/user";

/** Personal and always fresh: rendered in full per request, like /cart. */
export const instant = false;

export const metadata: Metadata = {
  title: t("pages.checkoutSuccess"),
  robots: { index: false, follow: false },
};

/**
 * Order confirmation (prototype `pSuccess()`). Only the order's owner sees it: the backend
 * answers 404 for anyone else's order, and so does this page.
 */
export default async function CheckoutSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = parseOrderId(id);
  const user = await requireUser(`/checkout/success/${id}`);
  if (orderId === null) notFound();
  if (!user) {
    return (
      <PageChrome path="/checkout/success/[id]">
        <p className="lm-err">{t("orders.unavailable")}</p>
      </PageChrome>
    );
  }
  const result = await getOrder(orderId);
  if (result.status === "not_found") notFound();
  if (result.status === "unavailable") {
    return (
      <PageChrome path="/checkout/success/[id]">
        <p className="lm-err">{t("orders.unavailable")}</p>
      </PageChrome>
    );
  }
  const order = result.data;
  return (
    <PageChrome path="/checkout/success/[id]">
      <CartEmptied />
      <div className="lm-narrow">
        <div className="lm-success" data-testid="order-success">
          <span className="lm-check">
            <CheckIcon />
          </span>
          <h1>{t("success.title")}</h1>
          <p>
            {t("success.number")} <b className="lm-num">#{order.id}</b>
          </p>
          <p className="lm-muted">{t("success.notify")}</p>
          <div className="lm-success-details lm-summary">
            <div className="lm-row">
              <span>{t("orderDetail.delivery")}</span>
              <span>{order.delivery.name}</span>
            </div>
            {order.delivery.fee_paid_to_carrier ? (
              <p className="lm-hint" data-testid="carrier-note">
                {t("checkout.carrierPaid")}
              </p>
            ) : null}
            <div className="lm-row total" data-testid="totals">
              <span>{t("cart.total")}</span>
              <Amounts
                items={order.totals.map((total) => ({
                  currency: total.currency,
                  amount: total.total,
                }))}
              />
            </div>
          </div>
          <div className="lm-acts">
            <Link
              href={`/account/orders/${order.id}`}
              className="lm-btn primary"
            >
              {t("success.track")}
            </Link>
            <Link href="/" className="lm-btn ghost">
              {t("success.continue")}
            </Link>
          </div>
        </div>
      </div>
    </PageChrome>
  );
}
