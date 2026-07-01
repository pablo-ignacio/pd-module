"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function IdentifyPage() {
  const [label, setLabel] = useState("");
  const [classPass, setClassPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [supabasePaused, setSupabasePaused] = useState(false);
  const [courseChecked, setCourseChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await supabase.auth.getSession();
      } catch {
        setSupabasePaused(true);
      }
    })();
  }, []);

  async function start() {
    setErr("");

    const v = label.trim();
    if (!v) {
      setErr("Please enter something (nickname, code, number, anything).");
      return;
    }

    if (!classPass.trim()) {
      setErr("Please enter the class password.");
      return;
    }

    setLoading(true);
    try {
      // 1) Verify class password (sets cookie pd_class_ok=1 if correct)
      const res = await fetch("/api/class-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: classPass.trim() }),
      });

      if (!res.ok) {
        setErr("Wrong password. Please ask the instructor.");
        return;
      }

      // 2) Initialize session storage for this participant/game
      const existingGameId = sessionStorage.getItem("pd_game_id");
      const gameId = existingGameId ?? crypto.randomUUID();

      sessionStorage.setItem("pd_participant_label", v);
      sessionStorage.setItem("pd_game_id", gameId);
      sessionStorage.setItem("pd_round", "1");
      sessionStorage.removeItem("pd_messages");
      if (courseChecked) {
        sessionStorage.setItem("pd_class_code", "NEG5055-S26");
      } else {
        sessionStorage.removeItem("pd_class_code");
      }

      // 3) Continue the flow
      window.location.href = "/instructions";
    } catch (e: any) {
      setErr(e?.message ?? "Could not verify password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "30px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Your ID</h1>

      {supabasePaused && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fff3cd", border: "1px solid #ffc107", color: "#856404", marginBottom: 14, fontSize: 14 }}>
          <b>Service is temporarily unavailable.</b> Please contact your instructor.
        </div>
      )}

      <p style={{ color: "#555" }}>
        Enter any identifier you want (nickname, code, number). It does not need to be your real name.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., Student7 or panda42"
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
          disabled={loading}
        />

        <input
          value={classPass}
          onChange={(e) => setClassPass(e.target.value)}
          placeholder="Class password"
          type="password"
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
          disabled={loading}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#333", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={courseChecked}
            onChange={(e) => setCourseChecked(e.target.checked)}
            disabled={loading}
          />
          Negotiation 5055 Summer 2026
        </label>

        <button
          onClick={start}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "white",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          {loading ? "Checking…" : "Start →"}
        </button>
      </div>

      {err && <p style={{ color: "crimson", marginTop: 10 }}>{err}</p>}
    </main>
  );
}
