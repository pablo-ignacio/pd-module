"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Msg = { role: "agent" | "student"; text: string };
type Move = "COOPERATE" | "DEFECT";
type Strategy = "ALWAYS_DEFECT" | "ALWAYS_COOPERATE" | "RANDOM_50_50";

function payoff(student: Move, agent: Move) {
  if (student === "COOPERATE" && agent === "COOPERATE") return { student: 3, agent: 3 };
  if (student === "COOPERATE" && agent === "DEFECT") return { student: 0, agent: 5 };
  if (student === "DEFECT" && agent === "COOPERATE") return { student: 5, agent: 0 };
  return { student: 1, agent: 1 };
}

export default function GamePage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [studentMove, setStudentMove] = useState<Move | null>(null);
  const [agentMove, setAgentMove] = useState<Move | null>(null);
  const [result, setResult] = useState<{ student: number; agent: number } | null>(null);

  const [strategy, setStrategy] = useState<Strategy>("ALWAYS_DEFECT");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // 1) Load transcript + strategy + session id
  useEffect(() => {
    const raw = sessionStorage.getItem("pd_messages");
    if (raw) {
      try {
        setMessages(JSON.parse(raw));
      } catch {}
    }

    const s = sessionStorage.getItem("pd_strategy");
    if (s === "ALWAYS_DEFECT" || s === "ALWAYS_COOPERATE" || s === "RANDOM_50_50") {
      setStrategy(s);
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

  const computedAgentMove: Move = useMemo(() => {
    if (strategy === "ALWAYS_DEFECT") return "DEFECT";
    if (strategy === "ALWAYS_COOPERATE") return "COOPERATE";
    return Math.random() < 0.5 ? "COOPERATE" : "DEFECT";
  }, [strategy]);

  async function choose(move: Move) {
    if (studentMove || !authReady) return;

    const aMove = computedAgentMove;
    const pay = payoff(move, aMove);

    setStudentMove(move);
    setAgentMove(aMove);
    setResult(pay);

    if (!sessionId) {
      alert("No session ID found. Please restart from the chat page.");
      return;
    }

    const { error } = await supabase
      .from("pd_sessions")
      .update({
        student_move: move,
        agent_move: aMove,
        student_payoff: pay.student,
        agent_payoff: pay.agent,
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
      <h1>Prisoner’s Dilemma</h1>

      <p>Choose your move. Person A chooses simultaneously.</p>

        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button
            onClick={() => choose("COOPERATE")}
            disabled={!!studentMove || !authReady}
            style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #ccc",
            background: "white",
            cursor: !!studentMove || !authReady ? "not-allowed" : "pointer",
            fontWeight: 700,
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            }}
        >
            Cooperate
        </button>

        <button
            onClick={() => choose("DEFECT")}
            disabled={!!studentMove || !authReady}
            style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #ccc",
            background: "white",
            cursor: !!studentMove || !authReady ? "not-allowed" : "pointer",
            fontWeight: 700,
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            }}
        >
            Defect
        </button>
        </div>


      {studentMove && agentMove && result && (
        <div>
          <p><b>Your move:</b> {studentMove}</p>
          <p><b>Person A’s move:</b> {agentMove}</p>
          <p><b>Payoffs (You, A):</b> ({result.student}, {result.agent})</p>
        </div>
      )}

      <button onClick={() => (window.location.href = "/")} style={{ marginTop: 20 }}>
        ← Back to Chat
      </button>
    </main>
  );
}
