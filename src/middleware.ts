import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "admin_token";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow login endpoint always
  if (pathname.startsWith("/api/admin/login")) return NextResponse.next();

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname.startsWith("/api/admin/");

  if (!isAdminRoute && !isAdminApi) return NextResponse.next();

  // Edge-safe check: just require the cookie to exist
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (token) return NextResponse.next();

  // If calling admin APIs without cookie, block
  if (isAdminApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // For admin page, allow it to load (it will show login UI)
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
