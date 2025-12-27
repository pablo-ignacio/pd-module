"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from "recharts";

type Msg = { role: "agent" | "student"; text: string };

type DashboardRow = {
  game_id: string;
  participant_label: string;
  round_num: number;
  student_move: "COOPERATE" | "DEFECT" | null;
  agent_move: "COOPERATE" | "DEFECT" | null;
  student_payoff: number | null;
  agent_payoff: number | null;
  features: {
    num_student_msgs: number;
    num_agent_msgs: number;
    student_chars: number;
    agent_chars: number;
    student_questions: number;
    trust_words: number;
    suspicion_words: number;
    agreement_signal: boolean;
  };
  chat_preview: string;
  chat: Msg[];
  class_code: string | null;
  strategy: string | null;
  created_at: string;
};

    type LeaderboardRow = {
  game_id: string;
  participant_label: string;
  rounds: number;
  student_total: number;
  agent_total: number;
};

type DashboardData = {
  kpis: {
    participants: number;
    games: number;
    rounds: number;
    student_coop_rate: number | null;
    agent_coop_rate: number | null;
    avg_student_payoff: number | null;
    avg_agent_payoff: number | null;
    min_student_total: number | null;
    max_student_total: number | null;
  };
   
  roundSeries: Array<{
    round: number;
    n: number;
    student_coop_rate: number | null;
    agent_coop_rate: number | null;
    avg_student_payoff: number | null;
    avg_agent_payoff: number | null;
  }>;
  rows: DashboardRow[];
  

 leaderboard: LeaderboardRow[];

  
};

function pct(x: number | null) {
  if (x === null || !Number.isFinite(x)) return "—";
  return `${Math.round(x * 100)}%`;
}

function num(x: number | null) {
  if (x === null || !Number.isFinite(x)) return "—";
  return (Math.round(x * 100) / 100).toString();
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  // Optional simple filter (you can extend later)
  const [classCode, setClassCode] = useState<string>("");

  // Drilldown
  const [selected, setSelected] = useState<DashboardRow | null>(null);

  const [completedOnly, setCompletedOnly] = useState<boolean>(true);
    const [afterLocal, setAfterLocal] = useState<string>("");   // datetime-local string
    const [beforeLocal, setBeforeLocal] = useState<string>(""); // datetime-local string

    function toIsoUtc(dtLocal: string) {
    // dtLocal is like "2025-12-21T14:00"
    if (!dtLocal) return "";
    const d = new Date(dtLocal);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString(); // converts local time to UTC ISO string
    }


async function refresh() {
  setLoading(true);
  setErr("");
  try {
    const params = new URLSearchParams();

    if (classCode.trim()) params.set("class_code", classCode.trim());
    if (completedOnly) params.set("completed", "1");

    const afterIso = toIsoUtc(afterLocal);
    const beforeIso = toIsoUtc(beforeLocal);

    if (afterIso) params.set("after", afterIso);
    if (beforeIso) params.set("before", beforeIso);

    const qs = params.toString() ? `?${params.toString()}` : "";

    const res = await fetch(`/api/dashboard${qs}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Dashboard API error");
    setData(json);
  } catch (e: any) {
    setErr(e?.message ?? "Could not load dashboard.");
  } finally {
    setLoading(false);
  }
}


  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedOnly]);

        const chatLengthBuckets = useMemo(() => {
        if (!data) return [];

        // Define bins explicitly
        const BIN_DEFS: Array<{ label: string; min: number; max: number | null }> = [
            { label: "0–30", min: 0, max: 30 },
            { label: "31–50", min: 31, max: 50 },
            { label: "51–80", min: 51, max: 80 },
            { label: "81–120", min: 81, max: 120 },
            { label: "121–180", min: 121, max: 180 },
            { label: "181–240", min: 181, max: 240 },
            { label: "241–300", min: 241, max: 300 },
            { label: "301–330", min: 301, max: 330 },
            { label: "331+", min: 331, max: null },
        ];

        // Initialize buckets
        const buckets: Record<string, { coop: number; n: number }> = {};
        for (const b of BIN_DEFS) {
            buckets[b.label] = { coop: 0, n: 0 };
        }

        // Assign rows to bins
        for (const r of data.rows) {
            const chars = r.features?.student_chars ?? 0;

            const bin = BIN_DEFS.find(
            (b) =>
                chars >= b.min &&
                (b.max === null || chars <= b.max)
            );

            if (!bin) continue;

            buckets[bin.label].n += 1;
            if (r.student_move === "COOPERATE") {
            buckets[bin.label].coop += 1;
            }
        }

        // Convert to chart-ready array
        return BIN_DEFS.map((b) => ({
            bucket: b.label,
            coop_rate: buckets[b.label].n
            ? Math.round((buckets[b.label].coop / buckets[b.label].n) * 100)
            : 0,
            n: buckets[b.label].n,
        }));
        }, [data]);



  
  // --- Chart helpers ---
  const coopSeries = useMemo(() => {
    if (!data) return [];
    return data.roundSeries.map((r) => ({
      round: r.round,
      Students: r.student_coop_rate === null ? null : Math.round(r.student_coop_rate * 100),
      "Person A": r.agent_coop_rate === null ? null : Math.round(r.agent_coop_rate * 100),
      n: r.n,
    }));
  }, [data]);

  // Relationship: trust_words bucket vs student cooperation rate
  const trustBuckets = useMemo(() => {
    if (!data) return [];
    const buckets: Record<string, { coop: number; n: number }> = {
      "0": { coop: 0, n: 0 },
      "1": { coop: 0, n: 0 },
      "2-3": { coop: 0, n: 0 },
      "4+": { coop: 0, n: 0 },
    };

    for (const r of data.rows) {
      const tw = r.features?.trust_words ?? 0;
      let key: keyof typeof buckets = "0";
      if (tw === 0) key = "0";
      else if (tw === 1) key = "1";
      else if (tw === 2 || tw === 3) key = "2-3";
      else key = "4+";

      buckets[key].n += 1;
      if (r.student_move === "COOPERATE") buckets[key].coop += 1;
    }

    return (Object.keys(buckets) as Array<keyof typeof buckets>).map((k) => ({
      bucket: k,
      coop_rate: buckets[k].n ? Math.round((buckets[k].coop / buckets[k].n) * 100) : 0,
      n: buckets[k].n,
    }));
  }, [data]);

  const rowsSorted = useMemo(() => {
    if (!data) return [];
    return [...data.rows].sort((a, b) => {
      if (a.participant_label !== b.participant_label) return a.participant_label.localeCompare(b.participant_label);
      return a.round_num - b.round_num;
    });
  }, [data]);

  return (
    <main style={{ maxWidth: 1100, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end" }}>
        <div>
          <h1 style={{ margin: 0 }}>PD Dashboard</h1>
          <p style={{ margin: "6px 0 0 0", color: "#666" }}>
            Manual refresh • Live from Supabase • Outcomes + dialog features
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "#666" }}>Class code (optional)</label>
            <input
              value={classCode}
              onChange={(e) => setClassCode(e.target.value)}
              placeholder="e.g., MBA-A1"
              style={{
                width: 180,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #ccc",
              }}
            />
          </div>

            <label
            style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "#444",
                marginTop: 18,
            }}
            >
            <input
                type="checkbox"
                checked={completedOnly}
                onChange={(e) => setCompletedOnly(e.target.checked)}
            />
            Only completed (10 rounds)
            </label>

            <button
            onClick={async () => {
                await fetch("/api/dashboard-auth", { method: "DELETE" });
                window.location.href = "/dashboard/login";
            }}
            style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ccc",
                background: "white",
                cursor: "pointer",
                height: 40,
                marginBottom: 2,
            }}
            >
            Log out
            </button>
  
           

          <button
            onClick={refresh}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "white",
              cursor: "pointer",
              height: 40,
              marginBottom: 2,
            }}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "#666" }}>From (local)</label>
            <input
                type="datetime-local"
                value={afterLocal}
                onChange={(e) => setAfterLocal(e.target.value)}
                style={{
                width: 200,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #ccc",
                }}
            />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "#666" }}>To (local)</label>
            <input
                type="datetime-local"
                value={beforeLocal}
                onChange={(e) => setBeforeLocal(e.target.value)}
                style={{
                width: 200,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #ccc",
                }}
            />
            </div>

      {err && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #f3b", borderRadius: 12, color: "#a00" }}>
          {err}
        </div>
      )}

      {!data && !err && (
        <p style={{ marginTop: 16, color: "#666" }}>{loading ? "Loading…" : "No data yet."}</p>
      )}

      {data && (
        <>
          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
            <KpiCard label="Participants" value={data.kpis.participants} />
            <KpiCard label="Rounds recorded" value={data.kpis.rounds} />
            <KpiCard label="Student coop rate" value={pct(data.kpis.student_coop_rate)} />
            <KpiCard label="Person A coop rate" value={pct(data.kpis.agent_coop_rate)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
            <KpiCard label="Avg student payoff" value={num(data.kpis.avg_student_payoff)} />
            <KpiCard label="Avg agent payoff" value={num(data.kpis.avg_agent_payoff)} />
            <KpiCard label="Min student total (10 rounds)" value={data.kpis.min_student_total ?? "—"} />
            <KpiCard label="Max student total (10 rounds)" value={data.kpis.max_student_total ?? "—"} />
          </div>

          {/* Charts */}
            <div
            style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr",
                gap: 12,
                marginTop: 16,
            }}
            >
            {/* Cooperation over rounds */}
            <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: 12, background: "white" }}>
                <h2 style={{ margin: "0 0 6px 0", fontSize: 16 }}>Cooperation by round</h2>
                <p style={{ margin: "0 0 12px 0", color: "#666", fontSize: 13 }}>
                Percent cooperating each round
                </p>

                <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                    <LineChart data={coopSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="round" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Students" dot={true} strokeWidth={5} />
                    <Line type="monotone" dataKey="Person A" dot={false} strokeWidth={1} />
                    </LineChart>
                </ResponsiveContainer>
                </div>
            </div>

            {/* Trust words */}
            <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: 12, background: "white" }}>
                <h2 style={{ margin: "0 0 6px 0", fontSize: 16 }}>Trust language</h2>
                <p style={{ margin: "0 0 12px 0", color: "#666", fontSize: 13 }}>
                Trust words vs cooperation
                </p>

                <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                    <BarChart data={trustBuckets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="coop_rate" />
                    </BarChart>
                </ResponsiveContainer>
                </div>
            </div>

            {/* Chat length */}
            <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: 12, background: "white" }}>
                <h2 style={{ margin: "0 0 6px 0", fontSize: 16 }}>Chat length</h2>
                <p style={{ margin: "0 0 12px 0", color: "#666", fontSize: 13 }}>
                Student message length vs cooperation
                </p>

                <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                    <BarChart data={chatLengthBuckets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="coop_rate" />
                    </BarChart>
                </ResponsiveContainer>
                </div>
            </div>
            </div>

{/* Leaderboard */}
<div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 14, overflow: "hidden", background: "white" }}>
  <div style={{ padding: 12, borderBottom: "1px solid #eee" }}>
    <h2 style={{ margin: 0, fontSize: 16 }}>Leaderboard (student total points)</h2>
    <p style={{ margin: "6px 0 0 0", color: "#666", fontSize: 13 }}>
      Ranked by total student payoff (filters apply)
    </p>
  </div>

  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ background: "#fafafa" }}>
          <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#666", borderBottom: "1px solid #eee" }}>Rank</th>
          <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#666", borderBottom: "1px solid #eee" }}>Participant</th>
          <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#666", borderBottom: "1px solid #eee" }}>Rounds</th>
          <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#666", borderBottom: "1px solid #eee" }}>Student total</th>
          <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#666", borderBottom: "1px solid #eee" }}>Person A total</th>
        </tr>
      </thead>
      <tbody>
       {(data.leaderboard ?? []).map(
        (r: LeaderboardRow, idx: number) => (
          <tr key={`${r.game_id}-${r.participant_label}`} style={{ borderTop: "1px solid #eee" }}>
            <td style={{ padding: "10px 12px" }}>{idx + 1}</td>
            <td style={{ padding: "10px 12px" }}>{r.participant_label || "—"}</td>
            <td style={{ padding: "10px 12px" }}>{r.rounds}</td>
            <td style={{ padding: "10px 12px" }}>{r.student_total}</td>
            <td style={{ padding: "10px 12px" }}>{r.agent_total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>


          {/* Table */}
          <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 14, overflow: "hidden", background: "white" }}>
            <div style={{ padding: 12, borderBottom: "1px solid #eee" }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Rounds table (click a row to read the chat)</h2>
              <p style={{ margin: "6px 0 0 0", color: "#666", fontSize: 13 }}>
                Each row is one participant × one round
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#fafafa" }}>
                    <Th>Participant</Th>
                    <Th>Round</Th>
                    <Th>Student</Th>
                    <Th>Agent</Th>
                    <Th>Payoff (S)</Th>
                    <Th>Payoff (A)</Th>
                    <Th>Dialog preview</Th>
                  </tr>
                </thead>
                <tbody>
                  {rowsSorted.slice().reverse().map((r) => (
                    <tr
                      key={`${r.game_id}-${r.participant_label}-${r.round_num}-${r.created_at}`}
                      onClick={() => setSelected(r)}
                      style={{ cursor: "pointer", borderTop: "1px solid #eee" }}
                    >
                      <Td>{r.participant_label || "—"}</Td>
                      <Td>{r.round_num}</Td>
                      <Td>{r.student_move ?? "—"}</Td>
                      <Td>{r.agent_move ?? "—"}</Td>
                      <Td>{r.student_payoff ?? "—"}</Td>
                      <Td>{r.agent_payoff ?? "—"}</Td>
                      <Td style={{ maxWidth: 520, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.chat_preview || "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          

          {/* Modal */}
          {selected && (
            <Modal onClose={() => setSelected(null)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <h2 style={{ margin: 0 }}>Chat transcript</h2>
                  <p style={{ margin: "6px 0 0 0", color: "#666", fontSize: 13 }}>
                    Participant: <b>{selected.participant_label}</b> • Round: <b>{selected.round_num}</b> •
                    Student: <b>{selected.student_move ?? "—"}</b> • A: <b>{selected.agent_move ?? "—"}</b>
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}
                >
                  Close
                </button>
              </div>

              <div style={{ marginTop: 12, padding: 12, border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#333" }}>
                  <b>Features:</b>{" "}
                  msgs(S)={selected.features.num_student_msgs}, questions={selected.features.student_questions}, trustWords=
                  {selected.features.trust_words}, suspicionWords={selected.features.suspicion_words}, agreement=
                  {selected.features.agreement_signal ? "yes" : "no"}
                </p>
              </div>

              <div style={{ marginTop: 12, maxHeight: 420, overflowY: "auto", paddingRight: 6 }}>
                {selected.chat?.length ? (
                  selected.chat.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: m.role === "student" ? "flex-end" : "flex-start",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "78%",
                          padding: "10px 12px",
                          borderRadius: 14,
                          border: "1px solid #ddd",
                          background: m.role === "student" ? "white" : "#f7f7f7",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                          {m.role === "student" ? "Student" : "Person A"}
                        </div>
                        <div style={{ fontSize: 14 }}>{m.text}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: "#666" }}>No chat captured for this row.</p>
                )}
              </div>
            </Modal>
          )}
        </>
      )}
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: 12, background: "white" }}>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: any }) {
  return (
    <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#666", borderBottom: "1px solid #eee" }}>
      {children}
    </th>
  );
}

function Td({ children, style }: { children: any; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: "10px 12px", verticalAlign: "top", ...(style ?? {}) }}>
      {children}
    </td>
  );
}

function Modal({ children, onClose }: { children: any; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(980px, 96vw)",
          background: "white",
          borderRadius: 16,
          padding: 14,
          border: "1px solid #ddd",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
