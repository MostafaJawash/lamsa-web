import "server-only";

import { env, isProduction } from "@/lib/env";

/** Which Google sign-in the auth pages show. */
export type GoogleMode =
  /** Google Identity Services with NEXT_PUBLIC_GOOGLE_CLIENT_ID. */
  | { kind: "gis"; clientId: string }
  /** Development without a client id: "دخول تجريبي بـ Google" (backend GOOGLE_DEV_MODE). */
  | { kind: "dev" }
  /** Production without a client id: no Google at all. */
  | { kind: "none" };

export function googleMode(): GoogleMode {
  if (env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)
    return { kind: "gis", clientId: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID };
  return isProduction ? { kind: "none" } : { kind: "dev" };
}

/** Development without a Google client id only. */
export function devGoogleAvailable(): boolean {
  return googleMode().kind === "dev";
}
