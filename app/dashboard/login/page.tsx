"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardLoginPage() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [supabasePaused, setSupabasePaused] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await supabase.auth.getSession();
      } catch {
        setSupabasePaused(true);
      }
    })();
  }, []);

  async function onLogin() {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setErr("Wrong password.");
        return;
      }

      window.location.href = "/dashboard";
    } catch (e: any) {
      setErr(e?.message ?? "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ marginTop: 0 }}>Instructor Dashboard</h1>

      {supabasePaused && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fff3cd", border: "1px solid #ffc107", color: "#856404", marginBottom: 14, fontSize: 14 }}>
          <b>Supabase project is paused.</b> Go to{" "}
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{ color: "#856404" }}>
            supabase.com/dashboard
          </a>{" "}
          and resume it, then reload this page.
        </div>
      )}

      <p style={{ color: "#555" }}>Enter the dashboard password.</p>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Dashboard password"
          style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}
          disabled={loading}
          onKeyDown={(e) => e.key === "Enter" && onLogin()}
        />
        <button
          onClick={onLogin}
          disabled={loading}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}
        >
          {loading ? "Checking…" : "Enter"}
        </button>
      </div>

      {err && <p style={{ color: "crimson", marginTop: 10 }}>{err}</p>}
    </main>
  );
}
