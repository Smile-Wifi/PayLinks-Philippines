import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getMerchantFromCookie } from "@/lib/merchant-auth";
import crypto from "crypto";

export async function GET() {
  const merchant = await getMerchantFromCookie();
  if (!merchant) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const requests = await prisma.paymentRequest.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  const merchant = await getMerchantFromCookie();
  if (!merchant) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { customerName, amountPesos } = await req.json();
  if (!customerName || !amountPesos) {
    return NextResponse.json({ error: "Customer name and amount required" }, { status: 400 });
  }

  // FIXED PACKAGES ONLY - NO TAG, EXACT AMOUNT
  const amount = Number(amountPesos);
  if (amount !== 99 && amount !== 149) {
    return NextResponse.json({ error: "Only ₱99 and ₱149 allowed" }, { status: 400 });
  }

  const amountCentavos = amount * 100; // 9900 or 14900 - exact, matches GCash QR

  const request = await prisma.paymentRequest.create({
    data: {
      merchantId: merchant.id,
      customerName,
      baseAmount: amountCentavos,
      amountCentavos, // No + tag
      status: "pending",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      confirmationToken: "PM-" + crypto.randomBytes(6).toString("hex").toUpperCase(),
    },
  });
  return NextResponse.json(request);
}