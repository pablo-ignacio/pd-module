"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Msg = { role: "agent" | "student"; text: string };
type Strategy = "ALWAYS_DEFECT" | "ALWAYS_COOPERATE" | "RANDOM_50_50";

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [locked, setLocked] = useState(false);

  const [isInstructor, setIsInstructor] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>("ALWAYS_DEFECT");
  const [classCode, setClassCode] = useState("MBA-A1");

  const [authReady, setAuthReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [isTyping, setIsTyping] = useState(false);
  const [round, setRound] = useState<number>(1);
  const [participantLabel, setParticipantLabel] = useState<string>("");
  const [gameId, setGameId] = useState<string>("");

  useEffect(() => {
    // Require participant id; if missing, send to /identify
    const label = sessionStorage.getItem("pd_participant_label");
    if (!label) {
      window.location.href = "/identify";
      return;
    }
    setParticipantLabel(label);

    // Tie the 10 rounds together
    const gid = sessionStorage.getItem("pd_game_id") || "";
    setGameId(gid);

    // Round number (Default B: chat continues across rounds)
    const r = Number(sessionStorage.getItem("pd_round") || "1");
    setRound(Number.isFinite(r) ? r : 1);
  }, []);



  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Optional: agent may start the chat (sometimes)
  useEffect(() => {
    // Only on first load, only if chat is empty
    if (messagesRef.current.length > 0) return;

    const willStart = Math.random() < 0.3; // 30% chance
    if (!willStart) return;

    const delayMs = 500 + Math.random() * 1500; // 0.5–2s delay

    const timer = setTimeout(async () => {
      try {
        const reply = await getAgentReply([]); // empty chat context
        if (reply && reply.trim()) {
          setMessages([{ role: "agent", text: reply }]);
        }
      } catch {
        // ignore errors silently
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, []);

  // Keep latest messages (avoids stale state bugs)
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Instructor mode + local saved settings
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

  // Ensure anonymous auth session exists
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) console.error("Anonymous sign-in error:", error.message);
      }
      setAuthReady(true);
    })();
  }, []);

  // 30-second timer
  useEffect(() => {
    if (locked) return;
    if (timeLeft <= 0) {
      setLocked(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, locked]);

  async function getAgentReply(updatedMessages: Msg[]) {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: updatedMessages, strategy }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Agent error");
    return (data.text ?? "") as string;
  }

  async function onSend() {
    const text = input.trim();
    if (!text || locked) return;

    const updated: Msg[] = [...messagesRef.current, { role: "student", text }];
    setMessages(updated);
    setInput("");
    setIsTyping(true);
    try {
      

      const delayMs = 400 + Math.floor(Math.random() * 1800); // 400–2200ms
      await new Promise((r) => setTimeout(r, delayMs));

      const reply = await getAgentReply(updated);
      if (reply && reply.trim()) {
        setMessages((prev) => [...prev, { role: "agent", text: reply }]);
      }
    } 
    
    catch (e: any) {
      console.error(e?.message ?? e);

      setMessages((prev) => [
        ...prev,
        { role: "agent", text: "Agent error. Open DevTools (right-click → Inspect) → Network → /api/agent → Response to see why." },
      ]);
    
    } finally {
        setIsTyping(false);
    }
  }

  async function onContinue() {
    // Save for /game
    sessionStorage.setItem("pd_messages", JSON.stringify(messagesRef.current));
    sessionStorage.setItem("pd_strategy", strategy);
    sessionStorage.setItem("pd_class_code", classCode);

    // store transcript in DB
    const chatPayload = messagesRef.current.map((m) => ({ role: m.role, text: m.text }));

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw new Error(userErr.message);

      const userId = userData.user?.id;
      if (!userId) throw new Error("No user id found. Refresh and try again.");

      const { data, error } = await supabase
        .from("pd_sessions")
        .insert({
          user_id: userId,
          class_code: classCode,
          strategy,
          chat: chatPayload,
          participant_label: participantLabel,
          round_num: round,
          game_id: gameId,
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      if (!data?.id) throw new Error("Insert succeeded but no id returned.");

      sessionStorage.setItem("pd_session_id", data.id);
    } catch (e: any) {
      console.error("Supabase insert failed:", e?.message ?? e);
      alert("Chat save failed: " + (e?.message ?? "unknown error"));
      // allow continuing anyway
    }

    window.location.href = `/game?round=${round}`;

  }

  return (
    <main style={{ maxWidth: 720, margin: "30px auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Prisoner’s Dilemma Mini-Module</h1>
        <div style={{ fontSize: 14 }}>
          Step <b>1/2</b> · Chat · <b>{timeLeft}s</b>
        </div>
      </div>

      {isInstructor && (
        <div style={{ marginTop: 10, padding: 12, border: "1px dashed #bbb", borderRadius: 12 }}>
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
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc" }}
              />
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          height: 340,
          overflowY: "auto",
          background: "#fafafa",
          marginTop: 12,
        }}
      >
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: 10, display: "flex", justifyContent: msg.role === "student" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "80%", padding: "10px 12px", borderRadius: 12, background: msg.role === "student" ? "#e8f0fe" : "white", border: "1px solid #e2e2e2" }}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{msg.role === "student" ? "You" : "Person A"}</div>
              <div>{msg.text}</div>
            </div>
          </div>
        ))}
            {isTyping && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 6 }}>
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid #ddd",
                  background: "#fafafa",
                  fontSize: 14,
                }}
              >
                <span className="dots">...</span>
              </div>
            </div>
          )}

        <div ref={bottomRef} />
      </div>

      


      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          disabled={locked}
          placeholder={locked ? "Chat closed" : "Type here…"}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
        />
        <button
          onClick={onSend}
          disabled={locked}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}
        >
          Send
        </button>
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between" }}>
        <button
          onClick={() => {
            setMessages([]);
            setInput("");
            setTimeLeft(30);
            setLocked(false);
          }}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}
        >
          Reset
        </button>

        <button
          onClick={onContinue}
          disabled={!locked || !authReady}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}
        >
          Continue to Decision →
        </button>
      </div>
    </main>
  );
}
