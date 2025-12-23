import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/dashboard/:path*"], // protect dashboard only
};

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="PD Dashboard"' },
  });
}

export function middleware(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const user = process.env.DASH_USER || "instructor";
  const pass = process.env.DASH_PASS || "";

  if (!pass) return unauthorized(); // if you forgot to set env var, lock it

  if (!auth?.startsWith("Basic ")) return unauthorized();

  const b64 = auth.slice("Basic ".length);
  const [u, p] = Buffer.from(b64, "base64").toString().split(":");

  if (u === user && p === pass) return NextResponse.next();
  return unauthorized();
}
