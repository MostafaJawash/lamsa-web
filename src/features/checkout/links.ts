/**
 * The URL of /checkout. The selection (address, delivery method) lives in the URL, so the
 * page renders it on the server with or without JavaScript, and a notice explains why the
 * page was refreshed. Pure; used by the server action and the client form.
 */
export type CheckoutNotice = "price" | "method" | "address" | "location";

export const checkoutNotices: readonly CheckoutNotice[] = [
  "price",
  "method",
  "address",
  "location",
];

export function isCheckoutNotice(value: unknown): value is CheckoutNotice {
  return (checkoutNotices as readonly unknown[]).includes(value);
}

export function checkoutHref(
  parts: {
    address?: number | null;
    method?: string | null;
    notes?: string;
    gift?: string;
    notice?: CheckoutNotice;
    newAddress?: boolean;
  } = {},
): string {
  const query = new URLSearchParams();
  if (parts.address) query.set("address", String(parts.address));
  if (parts.method) query.set("method", parts.method);
  if (parts.newAddress) query.set("new", "1");
  if (parts.notes?.trim()) query.set("notes", parts.notes);
  if (parts.gift?.trim()) query.set("gift", parts.gift);
  if (parts.notice) query.set("notice", parts.notice);
  const text = query.toString();
  return text ? `/checkout?${text}` : "/checkout";
}
