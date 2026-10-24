import { NextResponse } from "next/server";

/**
 * POST /api/auth/refresh (skeleton).
 *
 * TODO(auth) cookie flow:
 * 1. Read the refresh token from the httpOnly cookie (getRefreshToken in src/lib/auth/session.ts).
 *    No cookie → 401 and clear the session.
 * 2. POST /auth/refresh {refresh_token} to FastAPI. Only one refresh at a time per session:
 *    each refresh token works once, and reusing an old one ends every session (TOKEN_REUSED).
 * 3. Success → setSessionTokens() with the new pair (rotate both cookies) and return 204.
 * 4. TOKEN_INVALID / TOKEN_REUSED / TOKEN_EXPIRED → clearSession() and return 401 so the
 *    client sends the user to /login.
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
