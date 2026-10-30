import { PageFlash } from "@/features/cart/components/page-flash";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountShell } from "@/components/layout/account-shell";
import { PageChrome } from "@/components/layout/page-chrome";
import { EmptyState } from "@/components/shared/empty-state";
import { BackendImage } from "@/components/shared/backend-image";
import { BagIcon } from "@/components/shared/icons";
import { Amount, Amounts } from "@/components/shared/price";
import { ProductSilhouette } from "@/components/shared/product-art";
import { getGovernorates, governorateName } from "@/features/account/queries";
import {
  describeAddressSnapshot,
  openStreetMapUrl,
} from "@/features/orders/address-snapshot";
import { CancelOrder } from "@/features/orders/components/cancel-order";
import { StatusPill } from "@/features/orders/components/order-row";
import { OrderTimeline } from "@/features/orders/components/order-timeline";
import { ReorderButton } from "@/features/orders/components/reorder-button";
import { getOrder, parseOrderId } from "@/features/orders/queries";
import { t } from "@/i18n";
import { requireUser } from "@/lib/auth/user";
import { formatDate } from "@/lib/format";

/** Personal, always fresh: rendered in full per request, like /cart (works without JavaScript). */
export const instant = false;

export const metadata: Metadata = {
  title: t("pages.orderDetail"),
  robots: { index: false, follow: false },
};

/** Whether a backend money string is zero ("0.00"): compared as text, no arithmetic. */
function isZero(amount: string): boolean {
  return /^0+(\.0+)?$/.test(amount);
}

/** Order detail (prototype `pOrder()`): status, timeline, items, delivery, address, payment, totals. */
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const path = `/account/orders/${id}`;
  const orderId = parseOrderId(id);
  const user = await requireUser(path);
  // Not a valid id, someone else's order and a missing order all look the same.
  if (orderId === null) notFound();
  const unavailable = (
    <PageChrome path="/account/orders/[id]">
      <AccountShell>
        <EmptyState icon={<BagIcon />} title={t("orders.unavailable")} />
      </AccountShell>
    </PageChrome>
  );
  if (!user) return unavailable;
  const [result, governorates] = await Promise.all([
    getOrder(orderId),
    getGovernorates(),
  ]);
  if (result.status === "not_found") notFound();
  if (result.status === "unavailable") return unavailable;
  const order = result.data;
  const names = governorates.status === "ok" ? governorates.data : [];
  const address = describeAddressSnapshot(order.shipping_address, (code) =>
    governorateName(names, code),
  );
  const feeBuckets = order.totals.filter(
    (total) => !isZero(total.shipping_fee),
  );

  return (
    <PageChrome
      path="/account/orders/[id]"
      title={t("orderDetail.title", { id: order.id })}
    >
      <AccountShell>
        <div className="lm-list-head">
          <h1>{t("orderDetail.title", { id: order.id })}</h1>
          <StatusPill status={order.status} label={order.status_label} />
        </div>
        <p className="lm-muted">
          {t("orders.placedOn", {
            date: formatDate(order.created_at, "dateTime"),
          })}
        </p>

        <OrderTimeline steps={order.timeline} />

        <div className="lm-summary" data-testid="order-summary">
          <div role="list" aria-label={t("orderDetail.items")}>
            {order.items.map((item, index) => {
              const body = (
                <>
                  {item.name}
                  {item.variant_label ? (
                    <>
                      <br />
                      <small className="lm-muted">{item.variant_label}</small>
                    </>
                  ) : null}
                </>
              );
              return (
                <div
                  className="lm-mini"
                  role="listitem"
                  key={`${item.product_id}-${index}`}
                >
                  <span className="lm-art">
                    <ProductSilhouette />
                    {item.image ? (
                      <BackendImage urls={item.image} alt="" sizes="44px" />
                    ) : null}
                  </span>
                  <span>
                    {item.product_slug ? (
                      <Link
                        href={
                          `/p/${encodeURIComponent(item.product_slug)}` as Route
                        }
                        className="lm-item-link"
                      >
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </span>
                  <b className="lm-num" dir="ltr">
                    ×{item.quantity}
                  </b>
                  <Amount value={item.line_total} currency={item.currency} />
                </div>
              );
            })}
          </div>

          <div className="lm-row" style={{ marginTop: 8 }}>
            <span>{t("cart.subtotal")}</span>
            <Amounts
              items={order.totals.map((total) => ({
                currency: total.currency,
                amount: total.subtotal,
              }))}
            />
          </div>
          <div className="lm-row" data-testid="delivery-row">
            <span>{order.delivery.name}</span>
            {feeBuckets.length > 0 ? (
              <Amounts
                items={feeBuckets.map((total) => ({
                  currency: total.currency,
                  amount: total.shipping_fee,
                }))}
              />
            ) : order.delivery.fee_paid_to_carrier ? (
              <span className="lm-carrier-note">
                {t("checkout.carrierPaid")}
              </span>
            ) : (
              <b className="free">{t("cart.free")}</b>
            )}
          </div>
          <div className="lm-row" data-testid="address-row">
            <span>
              {address ? t("orderDetail.address") : t("orderDetail.pickup")}
            </span>
            <span className="lm-addr-snapshot">
              {address ? (
                <>
                  {address.lines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                  {address.notes ? (
                    <span className="lm-muted">{address.notes}</span>
                  ) : null}
                  {address.location ? (
                    <a
                      href={openStreetMapUrl(address.location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lm-link"
                      data-testid="map-link"
                    >
                      {t("orderDetail.viewOnMap")}
                    </a>
                  ) : null}
                </>
              ) : (
                order.delivery.name
              )}
            </span>
          </div>
          <div className="lm-row" data-testid="payment-row">
            <span>{t("orderDetail.payment")}</span>
            <span>
              {t("orderDetail.cod")}
              {order.payment_status === "paid"
                ? `، ${t("orderDetail.paid")}`
                : order.payment_status === "refunded"
                  ? `، ${t("orderDetail.refunded")}`
                  : ""}
            </span>
          </div>
          {order.customer_notes ? (
            <div className="lm-row">
              <span>{t("checkout.notes")}</span>
              <span>{order.customer_notes}</span>
            </div>
          ) : null}
          {order.gift_message ? (
            <div className="lm-row">
              <span>{t("checkout.giftLabel")}</span>
              <span>{order.gift_message}</span>
            </div>
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

        <PageFlash />
        <div className="lm-order-actions">
          {order.can_cancel ? <CancelOrder orderId={order.id} /> : null}
          <ReorderButton orderId={order.id} />
        </div>
      </AccountShell>
    </PageChrome>
  );
}
