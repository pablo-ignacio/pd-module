"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Msg = { role: "agent" | "student"; text: string };
type Move = "COOPERATE" | "DEFECT";
type Strategy = "ALWAYS_DEFECT" | "ALWAYS_COOPERATE" | "RANDOM_50_50";



function payoff(student: Move, agent: Move) {
  if (student === "COOPERATE" && agent === "COOPERATE") return { studentPayoff: 3, agentPayoff: 3 };
  if (student === "COOPERATE" && agent === "DEFECT") return { studentPayoff: 0, agentPayoff: 5 };
  if (student === "DEFECT" && agent === "COOPERATE") return { studentPayoff: 5, agentPayoff: 0 };
  return { studentPayoff: 1, agentPayoff: 1 };
}

async function decideAgentMove(messages: Msg[], strategy: Strategy) {
  const res = await fetch("/api/decide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, strategy }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "decide error");

  return data as {
    agent_move: Move;
    reason: string;
    confidence: number;
  };
}

export default function GamePage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [strategy, setStrategy] = useState<Strategy>("ALWAYS_DEFECT");
  const [studentMove, setStudentMove] = useState<Move | null>(null);

  // decided on page load from /api/decide
  const [agentMove, setAgentMove] = useState<Move | null>(null);
  const [agentReason, setAgentReason] = useState<string>("");
  const [agentLoading, setAgentLoading] = useState<boolean>(true);
  const [agentError, setAgentError] = useState<string>("");

  const [result, setResult] = useState<{ studentPayoff: number; agentPayoff: number } | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);

  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [round, setRound] = useState<number>(1);

  useEffect(() => {
    const r = Number(sessionStorage.getItem("pd_round") || "1");
    setRound(Number.isFinite(r) ? r : 1);
  }, []);

  // 1) Load transcript + session id
  useEffect(() => {
    const raw = sessionStorage.getItem("pd_messages");
    const s = sessionStorage.getItem("pd_strategy");
    if (s === "ALWAYS_DEFECT" || s === "ALWAYS_COOPERATE" || s === "RANDOM_50_50") {
      setStrategy(s);
    }

    if (raw) {
      try {
        setMessages(JSON.parse(raw));
      } catch {}
    }

    setSessionId(sessionStorage.getItem("pd_session_id"));
  }, []);

  // 2) Ensure we are using the SAME anonymous session
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setAuthError(error.message);
        return;
      }
      if (!data.session) {
        setAuthError("No session found. Please return to the chat page and click Continue again.");
        return;
      }
      setAuthReady(true);
    })();
  }, []);

  // 3) Decide Person A's move ON PAGE LOAD based on the chat
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setAgentLoading(true);
        setAgentError("");

        const raw = sessionStorage.getItem("pd_messages");
        const msgs: Msg[] = raw ? JSON.parse(raw) : [];

        const decision = await decideAgentMove(msgs, strategy);

        if (cancelled) return;

        setAgentMove(decision.agent_move);
        setAgentReason(decision.reason || "");
      } catch (e: any) {
        if (cancelled) return;
        setAgentError(e?.message ?? "Could not decide agent move.");
        // fallback
        setAgentMove("DEFECT");
        setAgentReason("fallback");
      } finally {
        if (!cancelled) setAgentLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [strategy]);

  async function choose(move: Move) {
    // prevent multiple clicks
    if (studentMove || !authReady) return;

    if (!agentMove) {
      alert("Person A is still deciding. Please wait a moment.");
      return;
    }

    const decidedAgentMove = agentMove; // satisfy TypeScript

    const pay = payoff(move, decidedAgentMove);

    // update UI
    setStudentMove(move);
    setResult(pay);

    if (!sessionId) {
      alert("No session ID found. Please restart from the chat page.");
      return;
    }

    const { error } = await supabase
      .from("pd_sessions")
      .update({
        student_move: move,
        agent_move: decidedAgentMove,
        student_payoff: pay.studentPayoff,
        agent_payoff: pay.agentPayoff,
        agent_reason: agentReason, // safe even if column missing? (if missing it will error)
      })
      .eq("id", sessionId);

    if (error) {
      console.error("Supabase update failed:", error.message);
      alert("Database update failed: " + error.message);
    }
  }

  if (authError) {
    return (
      <main style={{ maxWidth: 600, margin: "40px auto", fontFamily: "system-ui" }}>
        <h2>Error</h2>
        <p>{authError}</p>
        <button onClick={() => (window.location.href = "/")}>← Back to Chat</button>
      </main>
    );
  }


return (
  <main style={{ maxWidth: 720, margin: "30px auto", padding: 16, fontFamily: "system-ui" }}>
    <h1>Prisoner’s Dilemma (Round {round} / 10)</h1>

    <p>Choose your move. Person A chooses simultaneously.</p>

    {/* Status line while agent decision loads */}
    {agentLoading && <p style={{ color: "#666" }}>Person A is deciding…</p>}
    {agentError && (
      <p style={{ color: "crimson" }}>
        Agent decision issue: {agentError} (using fallback)
      </p>
    )}

    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
      <button
        onClick={() => choose("COOPERATE")}
        disabled={!!studentMove || !authReady || agentLoading || !agentMove}
        style={{
          flex: 1,
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid #ccc",
          background: "white",
          cursor: !!studentMove || !authReady || agentLoading || !agentMove ? "not-allowed" : "pointer",
          fontWeight: 700,
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        Cooperate
      </button>

      <button
        onClick={() => choose("DEFECT")}
        disabled={!!studentMove || !authReady || agentLoading || !agentMove}
        style={{
          flex: 1,
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid #ccc",
          background: "white",
          cursor: !!studentMove || !authReady || agentLoading || !agentMove ? "not-allowed" : "pointer",
          fontWeight: 700,
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        Defect
      </button>
    </div>

    {studentMove && agentMove && result && (
      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <p><b>Your move:</b> {studentMove}</p>
        <p><b>Person A’s move:</b> {agentMove}</p>
        <p>
          <b>Payoffs (You, A):</b> ({result.studentPayoff}, {result.agentPayoff})
        </p>

        {/* Optional: show reason for analysis (hide in student mode if you want) */}
        {/*agentReason && (
          <p style={{ color: "#666", marginTop: 8 }}>
            <b>Agent note:</b> {agentReason}
          </p>
        )*/}
      </div>
    )}

    <button
      onClick={() => {
        const current = Number(sessionStorage.getItem("pd_round") || "1");
        const next = current + 1;

        if (next <= 10) {
          sessionStorage.setItem("pd_round", String(next));
          window.location.href = "/chat";
        } else {
          window.location.href = "/done";
        }
      }}
      style={{ marginTop: 20, padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}
    >
      {round < 10 ? "Next round →" : "Finish →"}
    </button>

  </main>
);
}