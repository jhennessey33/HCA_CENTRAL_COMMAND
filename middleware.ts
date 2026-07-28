import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  if (!sessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
