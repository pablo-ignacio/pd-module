export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const gameId = url.searchParams.get("game_id");
    const participantLabel = url.searchParams.get("participant_label");

    if (!gameId || !participantLabel) {
      return NextResponse.json(
        { error: "Missing game_id or participant_label" },
        { status: 400 }
      );
    }

    // Use service role on the server (safe here, NEVER in browser)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server env missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("pd_sessions")
      .select("student_payoff, agent_payoff, round_num")
      .eq("game_id", gameId)
      .eq("participant_label", participantLabel);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const roundsPlayed = data?.length ?? 0;
    const studentTotal = (data ?? []).reduce(
      (sum, r) => sum + (r.student_payoff ?? 0),
      0
    );
    const agentTotal = (data ?? []).reduce(
      (sum, r) => sum + (r.agent_payoff ?? 0),
      0
    );

    return NextResponse.json({
      roundsPlayed,
      studentTotal,
      agentTotal,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}
