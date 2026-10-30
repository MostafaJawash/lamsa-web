import type { Route } from "next";
import Link from "next/link";

import { Amounts } from "@/components/shared/price";
import { t } from "@/i18n";
import { formatDate, pluralize } from "@/lib/format";

import { statusTone } from "../status";
import type { OrderSummary } from "../types";

/** The status pill (prototype `.st`), showing the backend's own label. */
export function StatusPill({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return (
    <span className={`lm-st ${statusTone(status)}`} data-status={status}>
      {label}
    </span>
  );
}

/**
 * One order in the list (prototype `.order-row`): number, date, item count, the totals per
 * currency (never added together) and the status. A server component and a plain link.
 */
export function OrderRow({ order }: { order: OrderSummary }) {
  return (
    <Link
      href={`/account/orders/${order.id}` as Route}
      className="lm-order-row"
      role="listitem"
      data-order-id={order.id}
    >
      <span className="lm-o-main">
        <b>{t("orders.number", { id: order.id })}</b>
        <span className="lm-muted">
          {formatDate(order.created_at)}،{" "}
          {pluralize(order.items_count, "items")}
        </span>
        <Amounts
          inline
          items={order.totals.map((total) => ({
            currency: total.currency,
            amount: total.total,
          }))}
        />
      </span>
      <StatusPill status={order.status} label={order.status_label} />
    </Link>
  );
}
