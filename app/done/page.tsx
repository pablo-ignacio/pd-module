"use client";

import { useEffect, useState } from "react";

export default function DonePage() {
  const [loading, setLoading] = useState(true);
  const [studentTotal, setStudentTotal] = useState<number | null>(null);
  const [roundsPlayed, setRoundsPlayed] = useState<number | null>(null);
  const [err, setErr] = useState<string>("");
  const [agentTotal, setAgentTotal] = useState<number | null>(null);


  useEffect(() => {
    (async () => {
      try {
        const gameId = sessionStorage.getItem("pd_game_id");
        const label = sessionStorage.getItem("pd_participant_label");

        if (!gameId || !label) {
          setErr("Missing game id or participant id. Please restart from Instructions.");
          setLoading(false);
          return;
        }

        const res = await fetch(
          `/api/score?game_id=${encodeURIComponent(gameId)}&participant_label=${encodeURIComponent(label)}`
        );
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Could not load score");

        setStudentTotal(data.studentTotal ?? 0);
        setRoundsPlayed(data.roundsPlayed ?? 0);
        setAgentTotal(data.agentTotal ?? 0);

      } catch (e: any) {
        setErr(e?.message ?? "Could not load score.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: "30px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>All done</h1>
      <p>You completed the game. Thanks!</p>

      {loading && <p style={{ color: "#666" }}>Calculating your total score…</p>}

      {!loading && err && <p style={{ color: "crimson" }}>{err}</p>}

      {!loading && !err && (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
          <p style={{ margin: 0 }}>
            <b>Rounds recorded:</b> {roundsPlayed} / 10
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: 18 }}>
            <b>Your total points: </b> <b>{studentTotal}</b> (write them down)
          </p>
          <p style={{ margin: "4px 0 0 0", fontSize: 18 }}>
            Person A’s total points: {agentTotal}
          </p>
          <p style={{ margin: "4px 0 0 0", fontSize: 18 }}>
            Mutual trust every round could have yielded: 30 points each
          </p>

        </div>
      )}

        <p style={{ marginTop: 16, color: "#666" }}>
        You may now close this window.
        </p>

    </main>
  );
}
