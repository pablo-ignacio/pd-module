export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Msg = { role: "agent" | "student"; text: string };

function safeParseChat(chat: any): Msg[] {
  // chat can be:
  // - jsonb array [{role,text},...]
  // - text stringified JSON
  // - null
  try {
    if (!chat) return [];
    if (Array.isArray(chat)) return chat as Msg[];
    if (typeof chat === "string") return JSON.parse(chat) as Msg[];
    return [];
  } catch {
    return [];
  }
}

function computeChatFeatures(messages: Msg[]) {
  const studentTexts = messages
    .filter((m) => m.role === "student")
    .map((m) => m.text || "")
    .join(" ");

  const agentTexts = messages
    .filter((m) => m.role === "agent")
    .map((m) => m.text || "")
    .join(" ");

  const s = studentTexts.toLowerCase();

  const countMatches = (re: RegExp) => (studentTexts.match(re) || []).length;

  const trustWords = (s.match(/\btrust\b|\bdeal\b|\bfair\b|\bpromise\b|\bagree\b|\bcooperat(e|ion)\b/g) || []).length;
  const suspicionWords = (s.match(/\bdefect\b|\bcheat\b|\btrick\b|\blie\b|\bstab\b|\bscrew\b/g) || []).length;

  return {
    num_student_msgs: messages.filter((m) => m.role === "student").length,
    num_agent_msgs: messages.filter((m) => m.role === "agent").length,
    student_chars: studentTexts.length,
    agent_chars: agentTexts.length,
    student_questions: countMatches(/\?/g),
    trust_words: trustWords,
    suspicion_words: suspicionWords,
    agreement_signal: /\bok\b|\bokay\b|\bsure\b|\bdeal\b|\bagree\b|\blet's do it\b/.test(s),
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // Optional filters (we’ll add UI controls later)
    const classCode = url.searchParams.get("class_code") || null;
    const limit = Math.min(Number(url.searchParams.get("limit") || "2000"), 5000);
    const completedOnly = url.searchParams.get("completed") === "1";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const createdAfter = url.searchParams.get("after");  // ISO string
    const createdBefore = url.searchParams.get("before"); // ISO string


    let q = supabase
      .from("pd_sessions")
      .select(
        "id, created_at, class_code, participant_label, game_id, round_num, strategy, student_move, agent_move, student_payoff, agent_payoff, chat"
      )
      .order("created_at", { ascending: true })
      .limit(limit);

    if (classCode) q = q.eq("class_code", classCode);
        // Time window filters (expects ISO timestamps)
        if (createdAfter) q = q.gte("created_at", createdAfter);
        if (createdBefore) q = q.lte("created_at", createdBefore);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let rows = (data ?? []).filter((r) => r.game_id && r.round_num);

        // ---- Completed-only filter (exactly 10 rounds per participant_label per game_id) ----
        if (completedOnly) {
        const counts = new Map<string, number>(); // key = game_id|participant_label
        for (const r of rows) {
            const key = `${r.game_id}|${r.participant_label || ""}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        }
        rows = rows.filter((r) => {
            const key = `${r.game_id}|${r.participant_label || ""}`;
            return (counts.get(key) || 0) === 10;
        });
    }

        // ---- Summary KPIs ----
        const uniqueParticipants = new Set<string>();
        const uniqueGames = new Set<string>();
        let totalRounds = 0;

        let studentCoop = 0, studentMoves = 0;
        let agentCoop = 0, agentMoves = 0;

        let studentPaySum = 0, studentPayN = 0;
        let agentPaySum = 0, agentPayN = 0;

        // NEW: totals per participant (across rounds)
        const totalsMap = new Map<
        string,
        { studentTotal: number; agentTotal: number; rounds: number; participant: string; game: string }
        >();

// ---- Time series by round ----
const roundStats: Record<
  number,
  { n: number; studentCoop: number; agentCoop: number; studentPaySum: number; agentPaySum: number }
> = {};

// ---- Feature correlation-ish dataset (per round row) ----
const featureRows: Array<{
  game_id: string;
  participant_label: string;
  round_num: number;
  student_move: string | null;
  agent_move: string | null;
  student_payoff: number | null;
  agent_payoff: number | null;
  features: ReturnType<typeof computeChatFeatures>;
  chat_preview: string;
  chat: Msg[];
  class_code: string | null;
  strategy: string | null;
  created_at: string;
}> = [];

for (const r of rows) {
  totalRounds += 1;

  if (r.participant_label) uniqueParticipants.add(String(r.participant_label));
  if (r.game_id) uniqueGames.add(String(r.game_id));

  if (r.student_move) {
    studentMoves += 1;
    if (r.student_move === "COOPERATE") studentCoop += 1;
  }
  if (r.agent_move) {
    agentMoves += 1;
    if (r.agent_move === "COOPERATE") agentCoop += 1;
  }

  if (typeof r.student_payoff === "number") {
    studentPaySum += r.student_payoff;
    studentPayN += 1;
  }
  if (typeof r.agent_payoff === "number") {
    agentPaySum += r.agent_payoff;
    agentPayN += 1;
  }

  // NEW: add to participant totals
  const g = String(r.game_id);
  const p = String(r.participant_label || "");
  const totalKey = `${g}|${p}`;
  if (!totalsMap.has(totalKey)) {
    totalsMap.set(totalKey, { studentTotal: 0, agentTotal: 0, rounds: 0, participant: p, game: g });
  }
  const t = totalsMap.get(totalKey)!;
  t.rounds += 1;
  if (typeof r.student_payoff === "number") t.studentTotal += r.student_payoff;
  if (typeof r.agent_payoff === "number") t.agentTotal += r.agent_payoff;

  const roundNum = Number(r.round_num);
  if (!roundStats[roundNum]) {
    roundStats[roundNum] = { n: 0, studentCoop: 0, agentCoop: 0, studentPaySum: 0, agentPaySum: 0 };
  }
  roundStats[roundNum].n += 1;
  if (r.student_move === "COOPERATE") roundStats[roundNum].studentCoop += 1;
  if (r.agent_move === "COOPERATE") roundStats[roundNum].agentCoop += 1;
  if (typeof r.student_payoff === "number") roundStats[roundNum].studentPaySum += r.student_payoff;
  if (typeof r.agent_payoff === "number") roundStats[roundNum].agentPaySum += r.agent_payoff;

  const chatMsgs = safeParseChat(r.chat);
  const features = computeChatFeatures(chatMsgs);

  const preview = chatMsgs
    .slice(-4)
    .map((m) => (m.role === "student" ? "You: " : "A: ") + (m.text || ""))
    .join(" | ")
    .slice(0, 220);

  featureRows.push({
    game_id: g,
    participant_label: p,
    round_num: roundNum,
    student_move: r.student_move ?? null,
    agent_move: r.agent_move ?? null,
    student_payoff: typeof r.student_payoff === "number" ? r.student_payoff : null,
    agent_payoff: typeof r.agent_payoff === "number" ? r.agent_payoff : null,
    features,
    chat_preview: preview,
    chat: chatMsgs,
    class_code: r.class_code ?? null,
    strategy: r.strategy ?? null,
    created_at: r.created_at,
  });
}

// NEW: compute min/max student totals across participants
const totals = Array.from(totalsMap.values()).filter((x) => x.participant);
const minStudentTotal = totals.length ? Math.min(...totals.map((x) => x.studentTotal)) : null;
const maxStudentTotal = totals.length ? Math.max(...totals.map((x) => x.studentTotal)) : null;
// NEW: leaderboard (rank participants by total student points)
const leaderboard = totals
  // Keep only completed participants if you're using completedOnly filter upstream
  .map((t) => ({
    game_id: t.game,
    participant_label: t.participant,
    rounds: t.rounds,
    student_total: t.studentTotal,
    agent_total: t.agentTotal,
  }))
  .sort((a, b) => b.student_total - a.student_total);


const kpis = {
  participants: uniqueParticipants.size,
  games: uniqueGames.size,
  rounds: totalRounds,
  student_coop_rate: studentMoves ? studentCoop / studentMoves : null,
  agent_coop_rate: agentMoves ? agentCoop / agentMoves : null,
  avg_student_payoff: studentPayN ? studentPaySum / studentPayN : null,
  avg_agent_payoff: agentPayN ? agentPaySum / agentPayN : null,

  // NEW:
  min_student_total: minStudentTotal,
  max_student_total: maxStudentTotal,
};

const roundSeries = Object.keys(roundStats)
  .map((k) => Number(k))
  .sort((a, b) => a - b)
  .map((round) => {
    const s = roundStats[round];
    return {
      round,
      n: s.n,
      student_coop_rate: s.n ? s.studentCoop / s.n : null,
      agent_coop_rate: s.n ? s.agentCoop / s.n : null,
      avg_student_payoff: s.n ? s.studentPaySum / s.n : null,
      avg_agent_payoff: s.n ? s.agentPaySum / s.n : null,
    };
  });

return NextResponse.json({
  kpis,
  roundSeries,
  rows: featureRows,
  leaderboard,
});

    return NextResponse.json({
      kpis,
      roundSeries,
      rows: featureRows, // includes per-round features + preview + full chat for drilldown
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unknown error" }, { status: 500 });
  }
}
