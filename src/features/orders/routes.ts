/**
 * Which paths are a single order's page: `/account/orders/<id>` and `/checkout/success/<id>`.
 * The proxy uses this to answer a real 404 for an order that is not the visitor's (the page
 * itself calls `notFound()` too, but a page with a dynamic segment streams its shell first,
 * so only the proxy can set the status). Pure.
 */
const ORDER_PATH = /^\/(?:account\/orders|checkout\/success)\/([^/]+)$/;

export type OrderRoute =
  /** A well-formed id: ask the backend whether it is this customer's order. */
  | { action: "check"; id: number }
  /** Not a positive integer: no order can match. */
  | { action: "not-found" };

export function orderRoute(pathname: string): OrderRoute | null {
  const match = ORDER_PATH.exec(pathname.replace(/\/+$/, ""));
  if (!match) return null;
  const segment = match[1] ?? "";
  return /^\d{1,9}$/.test(segment) && Number(segment) > 0
    ? { action: "check", id: Number(segment) }
    : { action: "not-found" };
}
