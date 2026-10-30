/**
 * orders: server-side reads.
 * Backend: GET /orders?status_group=&page=&page_size=, GET /orders/{id}
 *
 * Personal and always fresh: read per request with the visitor's token, never cached.
 * Someone else's order is a backend 404 (ORDER_NOT_FOUND): the page answers not-found,
 * the same as for an order that does not exist. Server-only.
 */
import "server-only";

import { getApi, pageTimeout, unwrap } from "@/lib/api/client";
import { logQueryFailure, type DetailResult } from "@/lib/api/result";
import { ApiError } from "@/lib/errors";

import { statusGroupFor, type OrderFilter } from "./status";
import type { OrderDetail, OrderSummaryPage } from "./types";

export const ORDERS_PAGE_SIZE = 10;

export type OrdersResult =
  { status: "ok"; page: OrderSummaryPage } | { status: "unavailable" };

export async function getOrders(
  filter: OrderFilter,
  page: number,
): Promise<OrdersResult> {
  try {
    const api = await getApi();
    const result = await unwrap(
      api.GET("/orders", {
        params: {
          query: {
            status_group: statusGroupFor(filter),
            page,
            page_size: ORDERS_PAGE_SIZE,
          },
        },
        signal: pageTimeout(),
      }),
    );
    return { status: "ok", page: result };
  } catch (error) {
    logQueryFailure("orders", String(error));
    return { status: "unavailable" };
  }
}

/** One order of the signed-in customer: `not_found` for anyone else's or a missing one. */
export async function getOrder(id: number): Promise<DetailResult<OrderDetail>> {
  try {
    const api = await getApi();
    const order = await unwrap(
      api.GET("/orders/{order_id}", {
        params: { path: { order_id: id } },
        signal: pageTimeout(),
      }),
    );
    return { status: "ok", data: order };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404)
      return { status: "not_found" };
    logQueryFailure("order", String(error));
    return { status: "unavailable" };
  }
}

/** An order id from the URL: a positive integer, else null (the page is then not found). */
export function parseOrderId(value: string): number | null {
  return /^\d{1,9}$/.test(value) && Number(value) > 0 ? Number(value) : null;
}
