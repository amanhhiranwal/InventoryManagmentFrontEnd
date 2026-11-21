import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname, search } = request.nextUrl;

  const protectedRoutes = [
    "/dashboard",
    "/users",
    "/companies",
    "/locations",
    "/rbac",
    "/workflows",
    "/leads",
    "/sales",
    "/procurement",
    "/fulfilment",
    "/inventory",
  ];

  const authRoutes = ["/login"];

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );

  const isAuthRoute = authRoutes.includes(pathname);

  // User not logged in
  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // User already logged in
  if (isAuthRoute && token) {
    const redirect = request.nextUrl.searchParams.get("redirect");
    const target = redirect && redirect.startsWith("/") ? redirect : "/dashboard";
    return NextResponse.redirect(new URL(target, request.url));
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
    "/sales/:path*",
    "/procurement/:path*",
    "/fulfilment/:path*",
    "/inventory/:path*",
    "/login",
  ],
};
