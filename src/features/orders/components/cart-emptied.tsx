"use client";

import { useEffect } from "react";

import { badgeStore } from "@/features/cart/badge-store";

/**
 * Renders nothing. The order has just emptied the cart on the backend, so the header and
 * tabbar badges (a client store that survives navigations) are set to 0 without a reload.
 */
export function CartEmptied() {
  useEffect(() => {
    badgeStore.set({ cart: 0 });
  }, []);
  return null;
}
