"use client";

import { useEffect, useMemo, useState } from "react";

type Msg = { role: "agent" | "student"; text: string };
type Move = "COOPERATE" | "DEFECT";

function payoff(student: Move, agent: Move) {
  // Classic PD payoffs:
  // (C,C) -> (3,3)
  // (C,D) -> (0,5)
  // (D,C) -> (5,0)
  // (D,D) -> (1,1)
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
  const [strategy, setStrategy] = useState<"ALWAYS_DEFECT" | "ALWAYS_COOPERATE" | "RANDOM_50_50">("ALWAYS_DEFECT");


  // Load chat transcript from sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem("pd_messages");
    if (raw) {
        try {
        setMessages(JSON.parse(raw));
        } catch {
        // ignore parse errors
        }
    }

    const s = sessionStorage.getItem("pd_strategy");
    if (s === "ALWAYS_DEFECT" || s === "ALWAYS_COOPERATE" || s === "RANDOM_50_50") {
        setStrategy(s);
    }
    }, []);

  // Simple, transparent rule for Person A's move:
  // If student used trust/cooperate/team language in chat, A cooperates; otherwise A defects.
    const computedAgentMove: Move = useMemo(() => {
        if (strategy === "ALWAYS_DEFECT") return "DEFECT";
        if (strategy === "ALWAYS_COOPERATE") return "COOPERATE";
        // RANDOM_50_50
        return Math.random() < 0.5 ? "COOPERATE" : "DEFECT";
    }, [strategy]);

  function choose(move: Move) {
    if (studentMove) return; // prevent choosing twice
    setStudentMove(move);

    // Person A chooses immediately based on the rule above
    const aMove = computedAgentMove;
    setAgentMove(aMove);

    const pay = payoff(move, aMove);
    setResult(pay);
  }

  function explanation(s: Move, a: Move) {
    if (s === "COOPERATE" && a === "COOPERATE")
      return "Mutual cooperation: both of you do well. This is socially best, but not always stable without trust.";
    if (s === "COOPERATE" && a === "DEFECT")
      return "You cooperated and Person A defected: you get the worst outcome while A gets the best (the temptation to defect).";
    if (s === "DEFECT" && a === "COOPERATE")
      return "You defected and Person A cooperated: you get the best outcome, A gets the worst. This is why cooperation is risky.";
    return "Mutual defection: both of you avoid being exploited, but you both do worse than mutual cooperation.";
  }

  return (
    <main style={{ maxWidth: 720, margin: "30px auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Prisoner’s Dilemma Mini-Module</h1>
        <div style={{ fontSize: 14 }}>
          Step <b>2/2</b> · Decision
        </div>
      </div>

      <p style={{ marginTop: 8, color: "#444" }}>
        Choose your move. Person A will choose at the same time (using a simple rule).
      </p>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          background: "#fafafa",
          marginTop: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <button
            onClick={() => choose("COOPERATE")}
            disabled={!!studentMove}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #ccc",
              background: "white",
              cursor: studentMove ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            Cooperate
          </button>

          <button
            onClick={() => choose("DEFECT")}
            disabled={!!studentMove}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #ccc",
              background: "white",
              cursor: studentMove ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            Defect
          </button>
        </div>

        <div style={{ borderTop: "1px solid #e5e5e5", paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#666" }}>Your move</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {studentMove ? studentMove : "—"}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#666" }}>Person A’s move</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {agentMove ? agentMove : "—"}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "#666" }}>Payoffs (You, Person A)</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {result ? `(${result.student}, ${result.agent})` : "—"}
            </div>
          </div>

          <div style={{ marginTop: 10, color: "#333" }}>
            {studentMove && agentMove ? explanation(studentMove, agentMove) : ""}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}>
        <button
          onClick={() => (window.location.href = "/")}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "white",
            cursor: "pointer",
          }}
        >
          ← Back to Chat
        </button>

        <button
          onClick={() => {
            sessionStorage.removeItem("pd_messages");
            window.location.href = "/";
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "white",
            cursor: "pointer",
          }}
        >
          Restart
        </button>
      </div>
    </main>
  );
}
