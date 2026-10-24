import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 Proxy (the successor of middleware.ts). Runs before /account and /checkout.
 *
 * TODO(auth): optimistic check only. If neither session cookie (see src/lib/auth/session.ts)
 * is present, redirect to /login?next=<path>. Never call the backend or verify tokens
 * here; the real check happens where the data is read.
 */
export function proxy(request: NextRequest): NextResponse {
  void request;
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/checkout/:path*"],
};
