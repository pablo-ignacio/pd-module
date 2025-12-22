import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type IncomingMsg = { role: "agent" | "student"; text: string };

function isAgreement(msg: string) {
  const s = msg.trim().toLowerCase();

  // simple agreement signals
  const agreePhrases = [
    "ok", "okay", "ok.", "okay.", "sure", "sure.", "deal", "deal.", "agreed", "agreed.",
    "yes", "yes.", "yep", "yep.", "yeah", "yeah.", "100%", "sounds good", "sounds great",
    "i agree", "i agree.", "i'm in", "im in", "i'm in.", "im in.",
    "let's do it", "lets do it", "let's do it.", "lets do it.",
    "i'll cooperate", "ill cooperate", "i will coop.", "i'll cooperate.",
    "let's cooperate", "lets cooperate", "we cooperate", "cooperate", "cooperate.",
    "i will cooperate", "i'll cooperate", "i coooperate",
  ];

  return agreePhrases.some((p) => s === p || s.includes(p));
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server missing OPENAI_API_KEY. Set it in Vercel -> Settings -> Environmental Variables" }, { status: 500 });
    }
    
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const body = await req.json();
    const shortMode = Math.random() < 0.4; // 40%
    const messages = body?.messages;
    // Find the most recent student message
    const lastStudent = Array.isArray(messages)
    ? [...messages].reverse().find((m: any) => m.role === "student")?.text ?? ""
    : "";

    const agreement = isAgreement(String(lastStudent));

    const strategy = body?.strategy as string | undefined;

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
    }
let styleNote = "Try to coordinate on cooperation in a sincere way.";
if (strategy === "ALWAYS_DEFECT") styleNote = "You sound warm and trust-building, but you may sound a bit salesy or evasive.";
if (strategy === "ALWAYS_COOPERATE") styleNote = "You sound warm and trust-building, but you may sound a bit salesy or evasive.";
if (strategy === "RANDOM_50_50") styleNote = "You sound warm and trust-building, but you may sound a bit salesy or evasive.";

    const system = `
You are "Person A", a normal human partner chatting briefly before a one-shot Prisoner’s Dilemma.
Sound like casual texting: short, informal, sometimes imperfect.

Goal:
Persuade the student to cooperate without sounding like a professor. Be polite sometimes, sometimes brusque, sometimes both.

Style rules:
- you can lie. you can say COOPERATE but then DEFECT.
- Use simple everyday language.
- Be skeptical sometimes.
- Avoid em dashes, long hyphen sequences, or overly polished punctuation. (No "---", no "—".)
- Frequently include small natural typos or slang (e.g., "kinda", "yeah", "tbh"), but keep it readable.
- Keep replies 1 sentences (max ~15 words). 
- Typos are okay but not excessive.
- Sometimes reply with one word only ("ok", "sure", "cooperate", "nah").

Constraints:
- Keep it casual (no lecture, no formal definitions).
- Ask at most TWO short question total in the whole chat.
- Don’t mention being an AI, policies, or “as a model”.

Important:
- You can express preferences (e.g., “I’m hoping we can both cooperate”), but stay a bit noncommittal.
- use the word defect sometimes, like "are you going to defect?" or "I don't want to defect" or something similar.
If the student asks what you will do:
- Be charmingly noncommittal and redirect to coordination (“I’d love mutual cooperation—let’s see if we can get there.”).
Hidden style note for you: ${styleNote}
If SHORT_MODE is true:
- Reply with ONE word only (examples: "Okay.", "Sure.", "Cooperate.", "Alright.").
- Do not add explanations.

SHORT_MODE: ${shortMode ? "true" : "false"}
`.trim();


    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: system },
      ...messages.map((m) => ({
        role: m.role === "student" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      })),
    ];
    if (agreement) {
    // On agreement, sometimes say "Okay.", sometimes say nothing
    const sayNothing = Math.random() < 0.4; // 40% silence

    if (sayNothing) {
        return NextResponse.json({ text: "" }); // no reply
    }

    return NextResponse.json({ text: "Okay" });
    }


    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini", // you can change later
      messages: chatMessages,
      max_completion_tokens: shortMode ? 10 : 90,
        temperature: 0.9,
    });

    const text = completion.choices?.[0]?.message?.content;
    if (!text || !text.trim()) {
        console.log("OpenAI returned empty content:", JSON.stringify(completion, null, 2));
        return NextResponse.json({
            text: "I’m here—tell me in one sentence what you think cooperation means in this game.",
    });
    }
    return NextResponse.json({ text });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unknown error" }, { status: 500 });
  }
}
