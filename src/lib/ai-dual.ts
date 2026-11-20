// Dual AI verification - BOTH AIs must agree before auto-approve
// AI 1: Gemini (Google) - GEMINI_API_KEY
// AI 2: OpenAI GPT-4o-mini (OpenAI) - OPENAI_API_KEY
// If they disagree on amount OR ref -> REVIEW, never auto-approve

export type AiExtraction = {
  amountCentavos: number | null;
  gcashRef: string | null;
  senderName: string | null;
  confidence: number;
  provider: string;
  raw?: any;
};

const PROMPT = `You are a GCash receipt checker. Read this GCash screenshot.
Return ONLY valid JSON, no markdown, no explanation:
{"amountCentavos": number|null, "gcashRef": "string|null", "senderName": "string|null", "confidence": 0-100}
Rules:
- amountCentavos is in centavos: P149.00 = 14900, P99.00 = 9900
- gcashRef is the 13-digit Ref No. If blurry / not visible, return null, do NOT guess
- senderName is the sender name. If not visible, return null
- confidence: how sure are you the screenshot is real and readable? Lower it if blurry, cropped, edited, or screenshot-of-screenshot.
- If this is NOT a GCash receipt, confidence = 0, all null.`;

async function callGemini(imageBase64: string, mimeType: string): Promise<AiExtraction> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
      generationConfig: { temperature: 0, response_mime_type: "application/json" },
    }),
  });
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = JSON.parse(text);
  return { amountCentavos: parsed.amountCentavos ?? null, gcashRef: parsed.gcashRef ?? null, senderName: parsed.senderName ?? null, confidence: parsed.confidence ?? 0, provider: "gemini", raw: parsed };
}

async function callOpenAI(imageBase64: string, mimeType: string): Promise<AiExtraction> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } }] }],
    }),
  });
  const data: any = await res.json();
  const text = data?.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(text);
  return { amountCentavos: parsed.amountCentavos ?? null, gcashRef: parsed.gcashRef ?? null, senderName: parsed.senderName ?? null, confidence: parsed.confidence ?? 0, provider: "openai", raw: parsed };
}

export type DualResult = {
  agree: boolean;
  autoApprove: boolean;
  reason: string;
  gemini: AiExtraction | null;
  openai: AiExtraction | null;
  finalAmount: number | null;
  finalRef: string | null;
  minConfidence: number;
};

export async function verifyWithDualAI(imageBase64: string, mimeType = "image/jpeg", expectedAmountCentavos?: number): Promise<DualResult> {
  // Run BOTH in parallel - faster, and they can't copy each other
  const [g, o] = await Promise.allSettled([callGemini(imageBase64, mimeType), callOpenAI(imageBase64, mimeType)]);
  const gemini = g.status === "fulfilled" ? g.value : null;
  const openai = o.status === "fulfilled" ? o.value : null;

  if (!gemini && !openai) return { agree: false, autoApprove: false, reason: "Both AIs failed - manual review", gemini, openai, finalAmount: null, finalRef: null, minConfidence: 0 };
  if (!gemini || !openai) return { agree: false, autoApprove: false, reason: `Only ${gemini ? "Gemini" : "OpenAI"} responded - need both to agree, manual review`, gemini, openai, finalAmount: null, finalRef: null, minConfidence: 0 };

  const minConfidence = Math.min(gemini.confidence, openai.confidence);
  const amountAgree = gemini.amountCentavos !== null && gemini.amountCentavos === openai.amountCentavos;
  const refAgree = gemini.gcashRef !== null && gemini.gcashRef === openai.gcashRef;
  // Sender can differ slightly in case/spacing - normalize
  const norm = (s: string | null) => (s || "").toUpperCase().replace(/[^A-Z]/g, "");
  const senderAgree = !gemini.senderName || !openai.senderName || norm(gemini.senderName) === norm(openai.senderName);

  const amountMatchesExpected = expectedAmountCentavos === undefined || gemini.amountCentavos === expectedAmountCentavos;

  if (!amountAgree) return { agree: false, autoApprove: false, reason: `AIs disagree on amount: Gemini=${gemini.amountCentavos} vs OpenAI=${openai.amountCentavos} - REVIEW`, gemini, openai, finalAmount: null, finalRef: null, minConfidence };
  if (!refAgree) return { agree: false, autoApprove: false, reason: `AIs disagree on Ref No.: Gemini=${gemini.gcashRef} vs OpenAI=${openai.gcashRef} - REVIEW`, gemini, openai, finalAmount: null, finalRef: null, minConfidence };
  if (!senderAgree) return { agree: false, autoApprove: false, reason: `AIs disagree on sender: Gemini=${gemini.senderName} vs OpenAI=${openai.senderName} - REVIEW`, gemini, openai, finalAmount: null, finalRef: null, minConfidence };
  if (!amountMatchesExpected) return { agree: true, autoApprove: false, reason: `Both AIs agree amount is ${gemini.amountCentavos}, but expected ${expectedAmountCentavos} - REVIEW (wrong package?)`, gemini, openai, finalAmount: gemini.amountCentavos, finalRef: gemini.gcashRef, minConfidence };
  if (minConfidence < 85) return { agree: true, autoApprove: false, reason: `Both agree, but low confidence ${minConfidence}% (<85%) - REVIEW`, gemini, openai, finalAmount: gemini.amountCentavos, finalRef: gemini.gcashRef, minConfidence };

  return { agree: true, autoApprove: true, reason: `Both AIs agree: Amount=${gemini.amountCentavos}, Ref=${gemini.gcashRef}, Confidence=${minConfidence}% - AUTO APPROVED`, gemini, openai, finalAmount: gemini.amountCentavos, finalRef: gemini.gcashRef, minConfidence };
}
