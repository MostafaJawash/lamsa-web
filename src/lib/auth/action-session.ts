import "server-only";

import { getApi, type ApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/errors";
import { getClientContext } from "@/lib/http/client-context";

import { needsRefresh } from "./jwt";
import { refresher } from "./refresh";
import { clearSession, readTokens, setSession } from "./session";

/**
 * Server actions run without the proxy's refresh (it only handles GET/HEAD), and a
 * page may sit open longer than the access token lives. This returns a usable access
 * token, refreshing through the same single-flight refresher when it is missing or
 * about to expire (`force`: always), and stores the new pair. null: no session left.
 */
export async function freshAccessToken(force = false): Promise<string | null> {
  const { accessToken, refreshToken } = await readTokens();
  if (!force && accessToken && !needsRefresh(accessToken)) return accessToken;
  if (!refreshToken) return force ? null : accessToken;
  const outcome = await refresher.refresh(
    refreshToken,
    await getClientContext(),
  );
  if (outcome.kind === "refreshed") {
    await setSession(outcome.pair);
    return outcome.pair.access_token;
  }
  if (outcome.kind === "rejected") {
    await clearSession();
    return null;
  }
  return accessToken;
}

/**
 * Runs an authenticated backend call from a server action; on TOKEN_EXPIRED it
 * refreshes once and retries. Throws ApiError NOT_AUTHENTICATED without a session.
 */
export async function withAccess<T>(
  call: (api: ApiClient) => Promise<T>,
): Promise<T> {
  const token = await freshAccessToken();
  if (!token) throw new ApiError(401, "NOT_AUTHENTICATED", null);
  try {
    return await call(await getApi({ accessToken: token }));
  } catch (error) {
    if (!(error instanceof ApiError) || !error.is("TOKEN_EXPIRED")) throw error;
    const retried = await freshAccessToken(true);
    if (!retried) throw error;
    return call(await getApi({ accessToken: retried }));
  }
}
