import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    "/dashboard/:path*", 
    "/api/dashboard/:path*",
    "/identify",
    "/instructions",
    "/chat/:path*",
    "/game/:path*",
    "/done/:path*",], // protect all pages
};

function unauthorizedBasic() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="PD Dashboard"' },
  });
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 1) Protect /dashboard with Basic Auth (instructor)
  if (path.startsWith("/dashboard")) {
    const auth = req.headers.get("authorization");
    const user = process.env.DASH_USER || "instructor";
    const pass = process.env.DASH_PASS || "";

    if (!pass) return unauthorizedBasic();
    if (!auth?.startsWith("Basic ")) return unauthorizedBasic();

    const b64 = auth.slice("Basic ".length);
    const [u, p] = Buffer.from(b64, "base64").toString().split(":");
    if (u === user && p === pass) return NextResponse.next();
    return unauthorizedBasic();
  }

  // 2) Protect student pages (except /identify itself)
  // Allow /identify always, but require cookie for the rest
  if (path !== "/identify") {
    const ok = req.cookies.get("pd_class_ok")?.value;
    if (ok !== "1") {
      const url = req.nextUrl.clone();
      url.pathname = "/identify";
      url.searchParams.set("blocked", "1");
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}