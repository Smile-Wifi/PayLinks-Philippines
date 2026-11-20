import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getMerchantFromCookie } from "@/lib/merchant-auth";
import crypto from "crypto";
export async function GET() {
  const merchant = await getMerchantFromCookie();
  if (!merchant) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const requests = await prisma.paymentRequest.findMany({ where: { merchantId: merchant.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json(requests);
}
export async function POST(req: NextRequest) {
  const merchant = await getMerchantFromCookie();
  if (!merchant) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { customerName, amountPesos } = await req.json();
  if (!customerName || !amountPesos) return NextResponse.json({ error: "Customer name and amount required" }, { status: 400 });
  const amount = Number(amountPesos);
  // TEST + REAL: allow 10,15 for testing, 99,149 for real. NO other amounts.
  if (![10, 15, 99, 149].includes(amount)) return NextResponse.json({ error: "Only 10, 15, 99, 149 allowed" }, { status: 400 });
  const amountCentavos = amount * 100; // EXACT, NO TAG
  const request = await prisma.paymentRequest.create({ data: { merchantId: merchant.id, customerName, baseAmount: amountCentavos, amountCentavos, status: "pending", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), confirmationToken: "PM-" + crypto.randomBytes(6).toString("hex").toUpperCase() } });
  return NextResponse.json(request);
}
