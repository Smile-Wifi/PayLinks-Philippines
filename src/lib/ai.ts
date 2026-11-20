/**
 * AI extraction helpers for GCash SMS + Screenshots
 * Supports:
 *  - Google Gemini (free tier recommended)
 *  - Meta Muse Spark (your postpaid Meta Model API)
 *  - Graceful fallback to rule-based parser
 */

export interface ExtractedPayment {
  amountCentavos: number | null;
  gcashRef: string | null;
  senderName: string | null;
  paidAt: string | null; // ISO-ish string if found
  confidence: number; // 0–100
  raw: string; // raw AI response or note
  provider: "gemini" | "muse" | "rules";
}

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const MUSE_URL = "https://api.meta.ai/v1/chat/completions";

function getProvider(): "gemini" | "muse" | "auto" {
  const forced = (process.env.AI_PROVIDER || "auto").toLowerCase();
  if (forced === "gemini" || forced === "muse") return forced;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.META_MUSE_API_KEY) return "muse";
  return "auto";
}

/** Rule-based fallback (same as original parser, improved) */
export function extractWithRules(sms: string): ExtractedPayment {
  const amountMatch = sms.match(/(?:PHP|₱|P)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const refMatch = sms.match(
    /Ref\.?\s*(?:No\.?)?\s*:?\s*(\d[\d\s]{8,})/i
  );
  const senderMatch = sms.match(/from\s+(.+?)\s+(?:with|on|\.|,|Ref)/i);

  const amountCentavos = amountMatch
    ? Math.round(parseFloat(amountMatch[1].replace(/,/g, "")) * 100)
    : null;
  const gcashRef = refMatch ? refMatch[1].replace(/\D/g, "") : null;
  const senderName = senderMatch?.[1]?.trim() || null;

  let confidence = 30;
  if (amountCentavos && gcashRef) confidence = 75;
  if (amountCentavos && gcashRef && senderName) confidence = 85;

  return {
    amountCentavos,
    gcashRef,
    senderName,
    paidAt: null,
    confidence,
    raw: "rules",
    provider: "rules",
  };
}

async function callGemini(
  prompt: string,
  imageBase64?: string,
  mimeType = "image/jpeg"
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const parts: any[] = [{ text: prompt }];
  if (imageBase64) {
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
      },
    });
  }

  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callMuse(
  prompt: string,
  imageBase64?: string,
  mimeType = "image/jpeg"
): Promise<string> {
  const key = process.env.META_MUSE_API_KEY;
  if (!key) throw new Error("META_MUSE_API_KEY missing");

  const content: any[] = [{ type: "text", text: prompt }];
  if (imageBase64) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${mimeType};base64,${imageBase64.replace(
          /^data:image\/\w+;base64,/,
          ""
        )}`,
      },
    });
  }

  const res = await fetch(MUSE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "muse-spark-1.3", // or muse-spark-1.2 / contributor variant
      messages: [{ role: "user", content }],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Muse error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

function parseAIResponse(text: string, provider: "gemini" | "muse"): ExtractedPayment {
  // Expect JSON-like output. Be tolerant.
  let jsonStr = text.trim();
  const match = jsonStr.match(/\{[\s\S]*\}/);
  if (match) jsonStr = match[0];

  try {
    const obj = JSON.parse(jsonStr);
    const amount =
      typeof obj.amount === "number"
        ? Math.round(obj.amount * 100)
        : typeof obj.amountCentavos === "number"
        ? obj.amountCentavos
        : null;

    return {
      amountCentavos: amount,
      gcashRef: obj.ref || obj.gcashRef || obj.reference || null,
      senderName: obj.sender || obj.senderName || obj.from || null,
      paidAt: obj.date || obj.paidAt || null,
      confidence: typeof obj.confidence === "number" ? obj.confidence : 80,
      raw: text,
      provider,
    };
  } catch {
    // Fallback: try to pull numbers from free text
    const amountMatch = text.match(/(?:amount|php|₱)\s*[:=]?\s*([\d,]+\.?\d*)/i);
    const refMatch = text.match(/(?:ref|reference)\s*[:=]?\s*(\d{10,})/i);
    return {
      amountCentavos: amountMatch
        ? Math.round(parseFloat(amountMatch[1].replace(/,/g, "")) * 100)
        : null,
      gcashRef: refMatch ? refMatch[1] : null,
      senderName: null,
      paidAt: null,
      confidence: 50,
      raw: text,
      provider,
    };
  }
}

const EXTRACTION_PROMPT = `You are a precise payment receipt parser for GCash (Philippines).
Extract ONLY these fields from the given text or image. Reply with pure JSON, no markdown, no explanation:

{
  "amount": 149.37,
  "ref": "1234567890123",
  "sender": "JUAN D.",
  "date": "2026-11-20 14:32",
  "confidence": 92
}

Rules:
- amount must be the exact total paid (number, with cents if present)
- ref is the GCash Reference Number (digits only)
- sender is the name shown as "From"
- confidence is your certainty 0-100
- If a field is missing, use null
- Never invent data`;

/**
 * Extract from raw GCash SMS text
 */
export async function extractFromSms(rawSms: string): Promise<ExtractedPayment> {
  const provider = getProvider();

  // Always try rules first (fast + free)
  const rules = extractWithRules(rawSms);
  if (rules.confidence >= 80) return rules;

  try {
    if (provider === "gemini" || (provider === "auto" && process.env.GEMINI_API_KEY)) {
      const text = await callGemini(
        `${EXTRACTION_PROMPT}\n\nSMS text:\n${rawSms}`
      );
      return parseAIResponse(text, "gemini");
    }
    if (provider === "muse" || process.env.META_MUSE_API_KEY) {
      const text = await callMuse(
        `${EXTRACTION_PROMPT}\n\nSMS text:\n${rawSms}`
      );
      return parseAIResponse(text, "muse");
    }
  } catch (e) {
    console.error("AI SMS extraction failed, falling back to rules", e);
  }

  return rules;
}

/**
 * Extract from GCash screenshot (base64)
 */
export async function extractFromScreenshot(
  imageBase64: string,
  mimeType = "image/jpeg"
): Promise<ExtractedPayment> {
  const provider = getProvider();

  try {
    if (provider === "gemini" || (provider === "auto" && process.env.GEMINI_API_KEY)) {
      const text = await callGemini(EXTRACTION_PROMPT, imageBase64, mimeType);
      return parseAIResponse(text, "gemini");
    }
    if (provider === "muse" || process.env.META_MUSE_API_KEY) {
      const text = await callMuse(EXTRACTION_PROMPT, imageBase64, mimeType);
      return parseAIResponse(text, "muse");
    }
  } catch (e) {
    console.error("AI screenshot extraction failed", e);
  }

  // No AI available
  return {
    amountCentavos: null,
    gcashRef: null,
    senderName: null,
    paidAt: null,
    confidence: 0,
    raw: "No AI provider configured",
    provider: "rules",
  };
}