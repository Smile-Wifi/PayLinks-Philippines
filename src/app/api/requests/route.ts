import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getMerchantFromCookie } from "@/lib/merchant-auth";
import crypto from "crypto";
export async function GET() {
  const merchant = await getMerchantFromCookie();
  if (!merchant) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const requests = await prisma.paymentRequest.findMany({ where: { merchantId: merchant.id }, orderBy: { createdAt: "desc" }, take: 50, include: { payment: { select: { gcashRef: true, matchedBy: true } } } });
  return NextResponse.json({ requests });
}
export async function POST(req: NextRequest) {
  const merchant = await getMerchantFromCookie();
  if (!merchant) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !body.customerName || !body.amountPesos) return NextResponse.json({ error: "customerName and amountPesos required" }, { status: 400 });
  const amount = Number(body.amountPesos);
  if (![10, 15, 99, 149].includes(amount)) return NextResponse.json({ error: "Only 10, 15, 99, 149 allowed" }, { status: 400 });
  const amountCentavos = amount * 100;
  const request = await prisma.paymentRequest.create({ data: { merchantId: merchant.id, customerName: String(body.customerName), baseAmount: amountCentavos, amountCentavos, status: "pending", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), confirmationToken: "PM-" + crypto.randomBytes(6).toString("hex").toUpperCase(), externalId: body.externalId ? String(body.externalId) : undefined } });
  return NextResponse.json({ id: request.id, customerName: request.customerName, amountCentavos, status: request.status, checkoutUrl: `/pay/${request.id}` }, { status: 201 });
}
