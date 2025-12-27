import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/dashboard/:path*",

    // student flow
    "/identify",
    "/instructions",
    "/chat/:path*",
    "/game/:path*",
    "/done/:path*",
  ],
};

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // ---- Dashboard protection (cookie-based) ----
  // Allow the login page + login API without cookie
  if (path.startsWith("/dashboard/login") || path.startsWith("/api/dashboard-auth")) {
    return NextResponse.next();
  }

  // Protect dashboard + api/dashboard
  if (path.startsWith("/dashboard") || path.startsWith("/api/dashboard")) {
    const ok = req.cookies.get("pd_dash_ok")?.value;
    if (ok !== "1") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ---- Student flow protection (class cookie) ----
  // Allow identify + class-auth so students can enter
  if (path === "/identify" || path.startsWith("/api/class-auth")) {
    return NextResponse.next();
  }

  const classOk = req.cookies.get("pd_class_ok")?.value;
  if (classOk !== "1") {
    const url = req.nextUrl.clone();
    url.pathname = "/identify";
    url.searchParams.set("blocked", "1");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
