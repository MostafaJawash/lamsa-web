import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout (skeleton).
 *
 * TODO(auth) cookie flow:
 * 1. Read both tokens from the httpOnly cookies (getSessionTokens in src/lib/auth/session.ts).
 * 2. If there is a refresh token, POST /auth/logout {refresh_token} to FastAPI with the
 *    access token as Bearer (optional; it must belong to the same user). The backend
 *    always answers 204.
 * 3. clearSession() whatever the backend said, and return 204.
 * Same-origin only: check the Origin header (SameSite=Lax cookies + POST).
 */
export function POST(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Not implemented yet.",
        details: null,
      },
    },
    { status: 501 },
  );
}
