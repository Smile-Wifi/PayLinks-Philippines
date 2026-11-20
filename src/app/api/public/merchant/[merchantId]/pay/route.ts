import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";
export async function POST(req: NextRequest, { params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const { customerName, amountPesos, label } = await req.json();
  if (!customerName || !amountPesos) return NextResponse.json({ error: "Name and amount required" }, { status: 400 });
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant || !merchant.isActive) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  const baseAmount = Math.round(Number(amountPesos) * 100);
  const pending = await prisma.paymentRequest.findMany({ where: { merchantId, status: "pending" }, select: { amountCentavos: true } });
  const used = new Set(pending.map(p => p.amountCentavos % 100));
  let tag = 1;
  for (let i = 0; i < 100; i++) { const c = Math.floor(Math.random() * 99) + 1; if (!used.has(c)) { tag = c; break; } }
  const amountCentavos = baseAmount + tag;
  const request = await prisma.paymentRequest.create({
    data: { merchantId, customerName: customerName.toString().slice(0, 80), baseAmount, amountCentavos, status: "pending", notes: label ? `Fixed: ${label}` : undefined, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), confirmationToken: "PM-" + crypto.randomBytes(6).toString("hex").toUpperCase() },
  });
  return NextResponse.json(request);
}
