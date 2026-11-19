import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMerchant } from "@/lib/auth";
import { createPaymentRequest, expireStaleRequests } from "@/lib/matching";
import { prisma } from "@/lib/db";
import { formatPeso } from "@/lib/crypto";

const createSchema = z.object({
  customerName: z.string().min(1).max(120),
  amountPesos: z.number().positive().max(1_000_000),
  externalId: z.string().max(100).optional(),
  expiresInMinutes: z.number().int().min(5).max(120).optional(),
});

/** GET /api/requests — list recent requests */
export async function GET(req: NextRequest) {
  const auth = await requireMerchant(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  await expireStaleRequests(auth.merchant.id);

  const status = req.nextUrl.searchParams.get("status");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 50), 100);

  const requests = await prisma.paymentRequest.findMany({
    where: {
      merchantId: auth.merchant.id,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      payment: { select: { gcashRef: true, matchedBy: true, matchedAt: true } },
    },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      customerName: r.customerName,
      amount: formatPeso(r.amountCentavos),
      amountCentavos: r.amountCentavos,
      baseAmount: r.baseAmount,
      status: r.status,
      expiresAt: r.expiresAt,
      paidAt: r.paidAt,
      token: r.confirmationToken,
      tokenConfirmedAt: r.tokenConfirmedAt,
      externalId: r.externalId,
      payment: r.payment,
      createdAt: r.createdAt,
    })),
  });
}

/** POST /api/requests — create a new payment request */
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const request = await createPaymentRequest(auth.merchant.id, parsed.data);

    return NextResponse.json(
      {
        id: request.id,
        customerName: request.customerName,
        amount: formatPeso(request.amountCentavos),
        amountCentavos: request.amountCentavos,
        baseAmount: request.baseAmount,
        status: request.status,
        expiresAt: request.expiresAt,
        checkoutUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/pay/${request.id}`,
      },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 409 });
  }
}
