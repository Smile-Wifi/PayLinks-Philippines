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
  const baseAmount = Math.round(Number(amountPesos) * 100);
  const pending = await prisma.paymentRequest.findMany({ where: { merchantId: merchant.id, status: "pending" }, select: { amountCentavos: true } });
  const usedTags = new Set(pending.map(p => p.amountCentavos % 100));
  let tag = 1;
  for (let i = 0; i < 100; i++) { const c = Math.floor(Math.random() * 99) + 1; if (!usedTags.has(c)) { tag = c; break; } }
  if (usedTags.has(tag)) { for (let t = 1; t <= 99; t++) if (!usedTags.has(t)) { tag = t; break; } }
  if (usedTags.size >= 99) return NextResponse.json({ error: "Too many pending payments" }, { status: 400 });
  const amountCentavos = baseAmount + tag;
  const request = await prisma.paymentRequest.create({ data: { merchantId: merchant.id, customerName, baseAmount, amountCentavos, status: "pending", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), confirmationToken: "PM-" + crypto.randomBytes(6).toString("hex").toUpperCase() } });
  return NextResponse.json(request);
}
