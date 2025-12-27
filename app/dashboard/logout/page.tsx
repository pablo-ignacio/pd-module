"use client";

export default function Logout() {
  // This triggers the browser to forget the cached Basic Auth creds (works in most browsers)
  if (typeof window !== "undefined") {
    window.location.href = `https://logout:logout@${window.location.host}/dashboard`;
  }
  return (
    <main style={{ maxWidth: 700, margin: "30px auto", padding: 16, fontFamily: "system-ui" }}>
      <p>Logging out…</p>
    </main>
  );
}
