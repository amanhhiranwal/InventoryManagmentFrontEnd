import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  const pathname = request.nextUrl.pathname;

  const protectedRoutes = ["/dashboard", "/users", "/companies", "/locations", "/rbac", "/workflows", "/leads"];

  const authRoutes = ["/login"];

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );

  const isAuthRoute = authRoutes.includes(pathname);

  // User not logged in

  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // User already logged in

  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/users/:path*",
    "/companies/:path*",
    "/locations/:path*",
    "/rbac/:path*",
    "/workflows/:path*",
    "/leads/:path*",
    "/login"
  ],
};
