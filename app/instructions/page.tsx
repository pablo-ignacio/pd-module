"use client";

export default function InstructionsPage() {
  return (
    <main style={{ maxWidth: 720, margin: "30px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Prisoner’s Dilemma</h1>

      <p style={{ marginTop: 10 }}>
        You and Person A will each choose <b>Cooperate</b> or <b>Defect</b> at the same time.
      </p>
      <ul style={{ marginTop: 10, lineHeight: 1.5 }}>
        <li>If you both cooperate: you both do well. Each gets 3 points.</li>
        <li>If one defects and the other cooperates: the defector does best (5 points), the cooperator does worst (0 points).</li>
        <li>If you both defect: you both do worse than mutual cooperation. Each gets 1 point.</li>
      </ul>

      <p style={{ marginTop: 10 }}>
        You’ll chat briefly before each choice. There are 10 rounds.
        Make as many points as you can.
    </p>

      <button
        onClick={() => (window.location.href = "/chat")}
        style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}
      >
        Next →
      </button>
    </main>
  );
}
