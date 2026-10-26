import "server-only";

import { createHash } from "node:crypto";

import { createApiClient, toApiError } from "@/lib/api/client";
import type { Schema } from "@/lib/api/types";
import type { ClientContext } from "@/lib/http/client-context";

type TokenPair = Schema<"TokenPair">;

export type RefreshOutcome =
  /** New pair: set both cookies. */
  | { kind: "refreshed"; pair: TokenPair }
  /** TOKEN_REUSED / TOKEN_INVALID / TOKEN_EXPIRED (or a disabled account): clear the session. */
  | { kind: "rejected"; code: string }
  /** Backend down, slow or busy: keep the cookies and continue as is. */
  | { kind: "unavailable" };

export type RefreshCall = (
  refreshToken: string,
  client: ClientContext,
) => Promise<RefreshOutcome>;

/** The proxy must never hold a page for long: a slow backend means "unavailable". */
export const REFRESH_TIMEOUT_MS = 3_000;

/**
 * How long a settled refresh stays in the map. Requests that arrive right after a
 * refresh still carry the OLD refresh cookie (the browser hasn't stored the new one
 * yet); they get the same new pair instead of re-using the old token. The backend's
 * 20 s grace covers duplicates across processes.
 */
export const REFRESH_KEEP_MS = 10_000;

function keyOf(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

/**
 * Single-flight refresh per process: concurrent refreshes with the same refresh token
 * share one backend call. Keyed by a hash of the token, so the raw token is never a
 * map key; entries expire after `keepMs`. "unavailable" results are dropped at once,
 * so the next request tries again.
 */
export function createRefresher(
  call: RefreshCall,
  { keepMs = REFRESH_KEEP_MS }: { keepMs?: number } = {},
) {
  const inflight = new Map<string, Promise<RefreshOutcome>>();

  function forget(key: string, promise: Promise<RefreshOutcome>) {
    if (inflight.get(key) === promise) inflight.delete(key);
  }

  return {
    refresh(
      refreshToken: string,
      client: ClientContext,
    ): Promise<RefreshOutcome> {
      const key = keyOf(refreshToken);
      const existing = inflight.get(key);
      if (existing) return existing;
      const promise = call(refreshToken, client).catch((): RefreshOutcome => ({
        kind: "unavailable",
      }));
      inflight.set(key, promise);
      void promise.then((outcome) => {
        if (outcome.kind === "unavailable") {
          forget(key, promise);
          return;
        }
        const timer = setTimeout(() => forget(key, promise), keepMs);
        timer.unref?.();
      });
      return promise;
    },
    /** Entries currently held (tests). */
    get size(): number {
      return inflight.size;
    },
  };
}

/** POST /auth/refresh, mapped to an outcome. Never throws; never logs the token. */
export const callRefresh: RefreshCall = async (refreshToken, client) => {
  try {
    const { data, error, response } = await createApiClient({
      client,
    }).POST("/auth/refresh", {
      body: { refresh_token: refreshToken },
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
    if (response.ok && data) return { kind: "refreshed", pair: data };
    if ([401, 403, 422].includes(response.status))
      return { kind: "rejected", code: toApiError(response, error).code };
    return { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
};

/** The process-wide refresher (proxy and server actions). */
export const refresher = createRefresher(callRefresh);
