"use client";

import { useEffect } from "react";

import { badgeStore } from "@/features/cart/badge-store";

/**
 * Renders nothing: puts this request's unread count into the shared badge store, so the
 * tabbar, the header and the account navigation show what the page just read (after
 * marking one or all as read) without waiting for their own refresh.
 */
export function UnreadSync({ unread }: { unread: number }) {
  useEffect(() => {
    badgeStore.set({ notifications: unread });
  }, [unread]);
  return null;
}
