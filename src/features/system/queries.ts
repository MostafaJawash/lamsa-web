/**
 * system: server-side reads about the backend itself (development helpers).
 * Backend: GET /health (outside /api/v1)
 *
 * Server-only: never import this file from a client component.
 */
import "server-only";

import { connection } from "next/server";

import { env } from "@/lib/env";

/**
 * Whether the backend answers `/health` within 1.5 s. Uncached and request-time only
 * (renders inside <Suspense>); used for the development "backend is down" notice.
 */
export async function isBackendReachable(): Promise<boolean> {
  await connection();
  const healthUrl = new URL("/health", env.API_BASE_URL).toString();
  try {
    const response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(1_500),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}
