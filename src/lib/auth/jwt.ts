/**
 * Reads the `exp` claim of an access token WITHOUT verifying it. Only used to decide
 * when to refresh; the backend is the only verifier. Returns seconds since the epoch,
 * or null for anything that isn't a JWT with a numeric `exp`.
 */
export function accessTokenExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload: unknown = JSON.parse(json);
    if (typeof payload !== "object" || payload === null) return null;
    const exp = (payload as Record<string, unknown>).exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

/** Refresh when the access token expires within this many seconds. */
export const REFRESH_MARGIN_SECONDS = 60;

/** True when there is no usable access token: missing, unreadable or expiring soon. */
export function needsRefresh(
  accessToken: string | null | undefined,
  nowSeconds: number = Date.now() / 1000,
  marginSeconds: number = REFRESH_MARGIN_SECONDS,
): boolean {
  if (!accessToken) return true;
  const exp = accessTokenExp(accessToken);
  return exp === null || exp - nowSeconds <= marginSeconds;
}
