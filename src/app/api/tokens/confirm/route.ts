import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMerchant } from "@/lib/auth";
import { confirmToken } from "@/lib/matching";
import { formatPeso } from "@/lib/crypto";

const schema = z.object({
  token: z.string().min(10).max(30),
});

/** POST /api/tokens/confirm — staff confirms a single-use token */
export async function POST(req: NextRequest) {
  const auth = await requireMerchant(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token format" }, { status: 400 });
  }

  const result = await confirmToken(auth.merchant.id, parsed.data.token);

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: `Valid — ${result.request.id}`,
    request: {
      id: result.request.id,
      customerName: result.request.customerName,
      amount: formatPeso(result.request.amountCentavos),
    },
  });
}
