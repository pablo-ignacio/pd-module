"use client";

import { useMemo, useState } from "react";

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [classCode, setClassCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const downloadUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("key", key);
    if (classCode) params.set("class_code", classCode);
    return `/api/export?${params.toString()}`;
  }, [key, classCode]);

  async function testAuth() {
    setStatus(null);
    const res = await fetch(downloadUrl, { method: "GET" });
    if (res.status === 401) setStatus("Unauthorized (wrong key).");
    else if (!res.ok) setStatus(`Error: ${res.status}`);
    else setStatus("OK — download should work.");
  }

  return (
    <main style={{ maxWidth: 680, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Instructor Export</h1>
      <p>Download PD session data as CSV. Protect this page with your export key.</p>

      <label style={{ display: "block", fontWeight: 700, marginTop: 14 }}>Export key</label>
      <input
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Enter ADMIN_EXPORT_KEY"
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
      />

      <label style={{ display: "block", fontWeight: 700, marginTop: 14 }}>Class code (optional)</label>
      <input
        value={classCode}
        onChange={(e) => setClassCode(e.target.value)}
        placeholder="MBA-A1"
        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={testAuth} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }}>
          Test
        </button>

        <a
          href={downloadUrl}
          style={{
            display: "inline-block",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Download CSV
        </a>
      </div>

      {status && <p style={{ marginTop: 12 }}>{status}</p>}
    </main>
  );
}
