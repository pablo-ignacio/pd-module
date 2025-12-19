import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  const classCode = url.searchParams.get("class_code") || "";

  // Protect the export endpoint
  const expected = process.env.ADMIN_EXPORT_KEY || "";
  if (!expected || key !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // IMPORTANT: service role key must be server-side only
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceRole);

  let q = supabase.from("pd_sessions").select("*").order("created_at", { ascending: false });
  if (classCode) q = q.eq("class_code", classCode);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];

  // Convert to CSV
  const headers = [
    "id",
    "created_at",
    "user_id",
    "class_code",
    "strategy",
    "chat",
    "student_move",
    "agent_move",
    "student_payoff",
    "agent_payoff",
  ];

  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    const needs = /[",\n]/.test(s);
    return needs ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [
    headers.join(","),
    ...rows.map((r: any) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pd_sessions${classCode ? "_" + classCode : ""}.csv"`,
    },
  });
}
