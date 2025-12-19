"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Msg = { role: "agent" | "student"; text: string };
type Strategy = "ALWAYS_DEFECT" | "ALWAYS_COOPERATE" | "RANDOM_50_50";

export default function Home() {
  const script = useMemo(
    () => [
      "Hi — I’m Person A. In a moment we’ll play a Prisoner’s Dilemma.",
      "In this game, you and I each choose: Cooperate or Defect. We choose at the same time.",
      "If we both cooperate, we both do pretty well. If one defects while the other cooperates, the defector does best and the cooperator does worst.",
      "If we both defect, we both do worse than mutual cooperation.",
      "There’s no talking during the choice — this chat is just a short warm-up.",
      "In the next screen, you’ll pick your move. Ready?",
    ],
    []
  );

  const [messages, setMessages] = useState<Msg[]>([
    { role: "agent", text: "Hi — I’m Person A. Type a quick hello and we’ll start." },
  ]);

  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [locked, setLocked] = useState(false);
  const [scriptIndex, setScriptIndex] = useState(0);

  const [strategy, setStrategy] = useState<Strategy>("ALWAYS_DEFECT");
  const [isInstructor, setIsInstructor] = useState(false);
  const [classCode, setClassCode] = useState("MBA-A1");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // 1) Instructor mode toggle + load saved settings
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const instructorMode = params.get("instructor") === "1";
    setIsInstructor(instructorMode);

    const savedStrategy = localStorage.getItem("pd_strategy");
    if (savedStrategy === "ALWAYS_DEFECT" || savedStrategy === "ALWAYS_COOPERATE" || savedStrategy === "RANDOM_50_50") {
      setStrategy(savedStrategy);
    }

    const savedClass = localStorage.getItem("pd_class_code");
    if (savedClass) setClassCode(savedClass);
  }, []);

  // 2) Ensure anonymous session exists (no student login)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) console.error("Anonymous sign-in error:", error.message);
      }
    })();
  }, []);

  // countdown
  useEffect(() => {
    if (locked) return;
    if (timeLeft <= 0) {
      setLocked(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, locked]);

  // auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function addAgentLine() {
    const next = script[scriptIndex] ?? "Time’s up — click Continue.";
    setMessages((m) => [...m, { role: "agent", text: next }]);
    setScriptIndex((i) => Math.min(i + 1, script.length));
  }

  function onSend() {
    const text = input.trim();
    if (!text || locked) return;

    setMessages((m) => [...m, { role: "student", text }]);
    setInput("");

    setTimeout(() => addAgentLine(), 350);
  }

  async function onContinue() {
    // store transcript + strategy for next page
    sessionStorage.setItem("pd_messages", JSON.stringify(messages));
    sessionStorage.setItem("pd_strategy", strategy);
    sessionStorage.setItem("pd_class_code", classCode);

    // Insert row into Supabase
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw new Error(userErr.message);
      const userId = userData.user?.id;
      if (!userId) throw new Error("No anonymous user id found (auth.uid missing).");

      const { data, error } = await supabase
        .from("pd_sessions")
        .insert({
          user_id: userId,
          class_code: classCode,
          strategy,
          chat: JSON.parse(JSON.stringify(messages)),
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);

      // Save session id so /game can update the same row
      sessionStorage.setItem("pd_session_id", data.id);
    } catch (e: any) {
      console.error("Supabase insert failed:", e?.message ?? e);
      // We still allow the game to proceed even if DB insert fails
    }

    window.location.href = "/game";
  }

  return (
    <main style={{ maxWidth: 720, margin: "30px auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Prisoner’s Dilemma Mini-Module</h1>
        <div style={{ fontSize: 14 }}>
          Step <b>1/2</b> · Chat · <b>{timeLeft}s</b>
        </div>
      </div>

      {/* Instructor-only controls */}
      {isInstructor && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            border: "1px dashed #bbb",
            borderRadius: 12,
            background: "#fff",
          }}
        >
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
            Instructor settings (visible only with ?instructor=1)
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Person A strategy:</label>
              <select
                value={strategy}
                onChange={(e) => {
                  const v = e.target.value as Strategy;
                  setStrategy(v);
                  localStorage.setItem("pd_strategy", v);
                }}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc" }}
              >
                <option value="ALWAYS_DEFECT">Always defect</option>
                <option value="ALWAYS_COOPERATE">Always cooperate</option>
                <option value="RANDOM_50_50">Random (50/50)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Class code:</label>
              <input
                value={classCode}
                onChange={(e) => {
                  setClassCode(e.target.value);
                  localStorage.setItem("pd_class_code", e.target.value);
                }}
                placeholder="MBA-A1"
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc" }}
              />
            </div>
          </div>
        </div>
      )}

      <p style={{ marginTop: 8, color: "#444" }}>
        You have about 30 seconds. When the timer hits 0, chat stops and you continue to the decision.
      </p>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          height: 340,
          overflowY: "auto",
          background: "#fafafa",
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: 10,
              display: "flex",
              justifyContent: msg.role === "student" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "10px 12px",
                borderRadius: 12,
                background: msg.role === "student" ? "#e8f0fe" : "white",
                border: "1px solid #e2e2e2",
              }}
            >
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                {msg.role === "student" ? "You" : "Person A"}
              </div>
              <div>{msg.text}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
          disabled={locked}
          placeholder={locked ? "Chat closed" : "Type here…"}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
          }}
        />
        <button
          onClick={onSend}
          disabled={locked}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: locked ? "#f0f0f0" : "white",
            cursor: locked ? "not-allowed" : "pointer",
          }}
        >
          Send
        </button>
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between" }}>
        <button
          onClick={() => {
            setMessages([{ role: "agent", text: "Hi — I’m Person A. Type a quick hello and we’ll start." }]);
            setInput("");
            setTimeLeft(30);
            setLocked(false);
            setScriptIndex(0);
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "white",
            cursor: "pointer",
          }}
        >
          Reset
        </button>

        <button
          onClick={onContinue}
          disabled={!locked}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: !locked ? "#f0f0f0" : "white",
            cursor: !locked ? "not-allowed" : "pointer",
          }}
        >
          Continue to Decision →
        </button>
      </div>
    </main>
  );
}
