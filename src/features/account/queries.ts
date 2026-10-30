/**
 * account: server-side reads.
 * Backend: GET /users/me/addresses (personal), GET /governorates (public, cached)
 *
 * Addresses are personal: read per request with the visitor's token, never cached.
 * Governorates are the same for everyone: cached for an hour (the list is fixed).
 * Server-only.
 */
import "server-only";

import { cacheTag } from "next/cache";

import { getApi, pageTimeout, publicApi, unwrap } from "@/lib/api/client";
import {
  logQueryFailure,
  safeQuery,
  settle,
  type Loaded,
  type QueryResult,
} from "@/lib/api/result";

import type { Address, Governorate } from "./types";

async function loadGovernorates(): Promise<Loaded<Governorate[]>> {
  "use cache";
  cacheTag("governorates");
  return settle({ stale: 3600, revalidate: 3600, expire: 86_400 }, () =>
    unwrap(publicApi.GET("/governorates", { signal: pageTimeout() })),
  );
}

/** The 14 governorates (code and Arabic name), in the backend's order. */
export function getGovernorates(): Promise<QueryResult<Governorate[]>> {
  return safeQuery(
    "governorates",
    loadGovernorates,
    (governorates) => governorates.length === 0,
  );
}

export type AddressesResult =
  { status: "ok"; addresses: Address[] } | { status: "unavailable" };

/** The signed-in customer's addresses, default first as the backend orders them. */
export async function getAddresses(): Promise<AddressesResult> {
  try {
    const api = await getApi();
    const addresses = await unwrap(
      api.GET("/users/me/addresses", { signal: pageTimeout() }),
    );
    return { status: "ok", addresses };
  } catch (error) {
    logQueryFailure("addresses", String(error));
    return { status: "unavailable" };
  }
}

/** The Arabic name of a governorate code (the code itself when the list lacks it). */
export function governorateName(
  governorates: readonly Governorate[],
  code: string,
): string {
  return governorates.find((item) => item.code === code)?.name ?? code;
}
