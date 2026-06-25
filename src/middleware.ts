import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// Lightweight gate: require the session cookie for app routes. Full verify happens in pages/APIs.
export function middleware(req: NextRequest) {
  const hasToken = req.cookies.has("uzi_token");
  if (!hasToken) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}
export const config = { matcher: ["/onboarding/:path*", "/dashboard/:path*"] };
