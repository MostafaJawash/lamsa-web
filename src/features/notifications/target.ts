import type { Route } from "next";

import { linkTarget, type LinkTarget } from "@/features/banners/links";

import type { Notification } from "./types";

/**
 * Where a notification leads on the website: the banners' mapping (category, product,
 * brand, new, sale, https url) plus the customer's own order (`order`, or the `order_id`
 * of an order update). Admin links never reach a customer (the backend drops them); an
 * unknown or incomplete link is `none`, and the row is not a link.
 */
export function notificationTarget(
  notification: Pick<Notification, "link" | "order_id">,
): LinkTarget {
  const { link, order_id: orderId } = notification;
  if (link.type === "order") {
    const id = link.value?.trim() ?? "";
    return /^\d{1,9}$/.test(id) && Number(id) > 0
      ? { kind: "internal", href: `/account/orders/${id}` as Route }
      : { kind: "none" };
  }
  const target = linkTarget(link);
  if (target.kind === "none" && link.type === "none" && orderId)
    return { kind: "internal", href: `/account/orders/${orderId}` as Route };
  return target;
}
