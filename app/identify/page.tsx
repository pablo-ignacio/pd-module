"use client";

import { useState } from "react";

export default function IdentifyPage() {
  const [label, setLabel] = useState("");
  const [err, setErr] = useState("");

  function start() {
    const v = label.trim();
    if (!v) {
      setErr("Please enter something (nickname, code, number, anything).");
      return;
    }

    const existingGameId = sessionStorage.getItem("pd_game_id");
    const gameId = existingGameId ?? crypto.randomUUID();

    sessionStorage.setItem("pd_participant_label", v);
    sessionStorage.setItem("pd_game_id", gameId);
    sessionStorage.setItem("pd_round", "1");
    sessionStorage.removeItem("pd_messages");

    sessionStorage.setItem("pd_participant_label", label.trim());
    window.location.href = "/instructions";

  }

  return (
    <main style={{ maxWidth: 720, margin: "30px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Your ID</h1>
      <p style={{ color: "#555" }}>
        Enter any identifier you want (nickname, code, number). It does not need to be your real name.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., Student7 or panda42"
          style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
        />
        <button
          onClick={start}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}
        >
          Start →
        </button>
      </div>

      {err && <p style={{ color: "crimson", marginTop: 10 }}>{err}</p>}
    </main>
  );
}
