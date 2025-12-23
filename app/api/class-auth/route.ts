export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));

  const expected = process.env.CLASS_PASS || "";
  if (!expected) {
    return NextResponse.json({ error: "Server missing CLASS_PASS" }, { status: 500 });
  }

  if (typeof password !== "string" || password !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Set a cookie that middleware can read
  const res = NextResponse.json({ ok: true });
  res.cookies.set("pd_class_ok", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return res;
}
