/**
 * Order statuses and the list filter. The statuses are the backend's (`OrderStatus`: pending,
 * preparing, shipped, ready_for_pickup (historical), delivered, cancelled) and its labels are
 * shown as returned; this only groups them for the filter chips with the backend's own
 * `status_group` parameter (active, completed, cancelled), so no status list lives here.
 */
export const orderFilters = [
  "all",
  "active",
  "completed",
  "cancelled",
] as const;
export type OrderFilter = (typeof orderFilters)[number];

export type OrderStatusGroup = "active" | "completed" | "cancelled";

export function isOrderFilter(value: unknown): value is OrderFilter {
  return (orderFilters as readonly unknown[]).includes(value);
}

/** The `status_group` query of `GET /orders` for a chip (none for "all"). */
export function statusGroupFor(
  filter: OrderFilter,
): OrderStatusGroup | undefined {
  return filter === "all" ? undefined : filter;
}

/** `?status=` of the page → a filter ("all" for anything unknown). */
export function parseOrderFilter(
  value: string | string[] | undefined,
): OrderFilter {
  const first = Array.isArray(value) ? value[0] : value;
  return isOrderFilter(first) ? first : "all";
}

/** `?page=` → a page number of at least 1. */
export function parsePage(value: string | string[] | undefined): number {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first || !/^\d{1,6}$/.test(first)) return 1;
  return Math.max(1, Number(first));
}

/** Visual class of the status pill (prototype `.st.s0…s3`; `x` is cancelled). */
export function statusTone(status: string): "s0" | "s1" | "s2" | "s3" | "sx" {
  switch (status) {
    case "pending":
      return "s0";
    case "preparing":
      return "s1";
    case "shipped":
    case "ready_for_pickup":
      return "s2";
    case "delivered":
      return "s3";
    default:
      return "sx";
  }
}
