import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMerchant } from "@/lib/auth";
import { ingestPayment, parseGCashSms } from "@/lib/matching";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const ingestSchema = z.object({
  amountCentavos: z.number().int().positive().optional(),
  gcashRef: z.string().min(8).max(40).optional(),
  senderName: z.string().max(80).optional(),
  rawSms: z.string().max(2000).optional(),
  idempotencyKey: z.string().min(8).max(64).optional(),
});

/**
 * POST /api/payments/ingest
 * Accept structured fields or raw SMS.
 * Rate-limited. Supports idempotencyKey.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMerchant(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const ip = getClientIp(req);
  const rl = rateLimit(
    `ingest:${auth.merchant.id}:${ip}`,
    60,
    60 * 1000 // 60 / minute per merchant+ip
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let amountCentavos = parsed.data.amountCentavos;
  let gcashRef = parsed.data.gcashRef;
  let senderName = parsed.data.senderName;

  if (parsed.data.rawSms) {
    const extracted = await parseGCashSms(parsed.data.rawSms);
    if (!extracted) {
      return NextResponse.json(
        { error: "Could not extract amount and reference from SMS" },
        { status: 400 }
      );
    }
    amountCentavos = extracted.amountCentavos;
    gcashRef = extracted.gcashRef;
    senderName = senderName || extracted.senderName;
  }

  if (!amountCentavos || !gcashRef) {
    return NextResponse.json(
      { error: "amountCentavos and gcashRef are required (or provide rawSms)" },
      { status: 400 }
    );
  }

  const result = await ingestPayment(auth.merchant.id, {
    amountCentavos,
    gcashRef,
    senderName,
    rawSms: parsed.data.rawSms,
    idempotencyKey: parsed.data.idempotencyKey,
  } as any);

  return NextResponse.json(result);
}
