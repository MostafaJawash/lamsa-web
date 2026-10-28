"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";

import { getApi, unwrap } from "@/lib/api/client";

import { signCheckoutFingerprint, verifyCheckoutFingerprint } from "./fingerprint";

function id(value: FormDataEntryValue | null): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function beginCheckout(form: FormData): Promise<void> {
  const addressId = id(form.get("address_id"));
  const deliveryMethodCode = String(form.get("delivery_method_code") ?? "").trim();
  if (!addressId || !/^[a-z0-9_]{1,30}$/.test(deliveryMethodCode)) redirect("/checkout");
  const api = await getApi();
  const addresses = await unwrap(api.GET("/users/me/addresses"));
  const address = addresses.find((item) => item.id === addressId);
  if (!address) redirect("/checkout");
  const cart = await unwrap(
    api.GET("/cart", { params: { query: { governorate: address.governorate, delivery_method_code: deliveryMethodCode } } }),
  );
  const quote = cart.delivery_quotes.find((item) => item.code === deliveryMethodCode);
  if (!cart.can_checkout || !quote) redirect("/checkout");
  const totals = Object.fromEntries(quote.totals.map((item) => [item.currency, item.amount])) as Partial<Record<"SYP" | "USD", string>>;
  const state = signCheckoutFingerprint({ attempt: randomUUID(), addressId, deliveryMethodCode, totals });
  redirect(`/checkout?state=${encodeURIComponent(state)}`);
}

export async function placeCheckout(form: FormData): Promise<void> {
  const state = verifyCheckoutFingerprint(String(form.get("state") ?? ""));
  if (!state) redirect("/checkout");
  const api = await getApi();
  const order = await unwrap(
    api.POST("/orders", {
      params: { header: { "Idempotency-Key": state.attempt } },
      body: {
        delivery_method_code: state.deliveryMethodCode,
        address_id: state.addressId,
        expected_totals: state.totals,
        customer_notes: String(form.get("customer_notes") ?? "").trim() || null,
        gift_message: String(form.get("gift_message") ?? "").trim() || null,
      },
    }),
  );
  redirect(`/checkout/success/${order.id}`);
}
