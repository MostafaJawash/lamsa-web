import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountShell } from "@/components/layout/account-shell";
import { PageChrome } from "@/components/layout/page-chrome";
import { EmptyState } from "@/components/shared/empty-state";
import { BagIcon } from "@/components/shared/icons";
import { PagerLinks } from "@/features/catalog/components/list-results";
import { OrderRow } from "@/features/orders/components/order-row";
import { getOrders, ORDERS_PAGE_SIZE } from "@/features/orders/queries";
import {
  orderFilters,
  parseOrderFilter,
  parsePage,
  type OrderFilter,
} from "@/features/orders/status";
import { t } from "@/i18n";
import { requireUser } from "@/lib/auth/user";

const PATH = "/account/orders";

/** Personal, always fresh: rendered in full per request, like /cart (works without JavaScript). */
export const instant = false;

export const metadata: Metadata = {
  title: t("pages.orders"),
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function href(filter: OrderFilter, page = 1): Route {
  const query = new URLSearchParams();
  if (filter !== "all") query.set("status", filter);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return (text ? `${PATH}?${text}` : PATH) as Route;
}

/** Orders (prototype `pAccount()` orders list): filter chips, `.order-row` rows, the pager. */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser(PATH);
  const params = await searchParams;
  const filter = parseOrderFilter(params.status);
  const requested = parsePage(params.page);

  const head = (
    <div className="lm-list-head">
      <h1>{t("pages.orders")}</h1>
    </div>
  );
  const unavailable = (
    <PageChrome path={PATH}>
      <AccountShell>
        {head}
        <EmptyState icon={<BagIcon />} title={t("orders.unavailable")} />
      </AccountShell>
    </PageChrome>
  );
  if (!user) return unavailable;
  const result = await getOrders(filter, requested);
  if (result.status === "unavailable") return unavailable;
  const { items, total } = result.page;
  const pages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  // A page past the end (an old link after orders were removed): go to the last one.
  if (items.length === 0 && total > 0 && requested > pages)
    redirect(href(filter, pages));

  return (
    <PageChrome path={PATH}>
      <AccountShell>
        {head}
        <nav className="lm-chips" aria-label={t("orders.filters")}>
          {orderFilters.map((item) => (
            <Link
              key={item}
              href={href(item)}
              className={item === filter ? "lm-chip on" : "lm-chip"}
              aria-current={item === filter ? "true" : undefined}
              data-filter={item}
            >
              {t(`orders.filter.${item}`)}
            </Link>
          ))}
        </nav>
        {items.length === 0 ? (
          <EmptyState
            icon={<BagIcon />}
            title={t(
              filter === "all" ? "orders.emptyTitle" : "orders.emptyFiltered",
            )}
            action={
              filter === "all" ? (
                <Link href="/" className="lm-btn primary">
                  {t("orders.startShopping")}
                </Link>
              ) : (
                <Link href={href("all")} className="lm-btn ghost">
                  {t("orders.filter.all")}
                </Link>
              )
            }
          />
        ) : (
          <div role="list" aria-label={t("pages.orders")}>
            {items.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
        <PagerLinks
          page={requested}
          pages={pages}
          href={(page) => href(filter, page)}
        />
      </AccountShell>
    </PageChrome>
  );
}
