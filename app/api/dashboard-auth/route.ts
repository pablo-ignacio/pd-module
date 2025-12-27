export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = String(body?.password ?? "");

  const expected = process.env.DASH_PASS || "";
  if (!expected) {
    return NextResponse.json({ error: "Server missing DASH_PASS" }, { status: 500 });
  }

  if (password !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("pd_dash_ok", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return res;
}

export async function DELETE() {
  // logout: clear cookie
  const res = NextResponse.json({ ok: true });
  res.cookies.set("pd_dash_ok", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
