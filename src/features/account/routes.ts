/**
 * `/account/addresses?edit=<id>` and `?delete=<id>` name one address. The proxy uses this to
 * answer a real 404 when that address is not the signed-in customer's (see orders/routes.ts
 * for why only the proxy can set the status). Pure.
 */
export type AddressRoute =
  /** A well-formed id: ask the backend whether it is one of this customer's addresses. */
  | { action: "check"; id: number }
  /** Not a positive integer: no address can match. */
  | { action: "not-found" };

export function addressRoute(
  pathname: string,
  searchParams: URLSearchParams,
): AddressRoute | null {
  if (pathname.replace(/\/+$/, "") !== "/account/addresses") return null;
  const value = searchParams.get("edit") ?? searchParams.get("delete");
  if (value === null) return null;
  return /^\d{1,9}$/.test(value) && Number(value) > 0
    ? { action: "check", id: Number(value) }
    : { action: "not-found" };
}
