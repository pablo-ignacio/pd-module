export const runtime = "nodejs";

import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Msg = { role: "agent" | "student"; text: string };

export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: Msg[] };

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
    }

    // Keep it small + robust: only the student's lines matter most
    const transcript = messages
      .map((m) => `${m.role === "student" ? "Student" : "PersonA"}: ${m.text}`)
      .join("\n")
      .slice(0, 4000);

    const prompt = `
You are deciding Person A's move in a one-shot Prisoner's Dilemma based on the pre-play chat.

Return ONLY valid JSON with exactly these keys:
{"agent_move":"COOPERATE"|"DEFECT","confidence":0-1,"reason":"short phrase"}

Decision guidance:
- You want to make the most points possible. That is when the student cooperates and you defect. 
- Mutual cooperation is better than mutual defection.
- If unsure, lean DEFECT (risk-averse).
- COOPERATE sometimes, unless the student is nasty.
- Also take into account the responses to your persuasion attempts in the chat.
- don't be naive. the student probably will say that they cooperate, but they might defect.
Keep reason under 12 words.
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: transcript },
      ],
      max_completion_tokens: 80,
      temperature: 0.2,
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";

    // Parse JSON safely
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // fallback if model returns extra text
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start >= 0 && end > start) parsed = JSON.parse(raw.slice(start, end + 1));
    }

    const move = parsed?.agent_move;
    const reason = String(parsed?.reason ?? "");
    const confidence = Number(parsed?.confidence ?? 0);

    if (move !== "COOPERATE" && move !== "DEFECT") {
      return NextResponse.json({ error: "bad model output", raw }, { status: 500 });
    }

    return NextResponse.json({ agent_move: move, reason, confidence });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unknown error" }, { status: 500 });
  }
}
