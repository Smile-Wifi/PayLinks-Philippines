import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
export async function OPTIONS() { return new Response(null, { headers: CORS }); }
export async function POST(req: NextRequest, { params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const body = await req.json().catch(() => ({}));
  const { customerName, amountPesos } = body;
  if (!customerName || !amountPesos) return NextResponse.json({ error: "customerName and amountPesos required" }, { status: 400, headers: CORS });
  const amount = Number(amountPesos);
  if (![10, 15, 99, 149].includes(amount)) return NextResponse.json({ error: "Only 10, 15, 99, 149 allowed" }, { status: 400, headers: CORS });
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) return NextResponse.json({ error: "Merchant not found" }, { status: 404, headers: CORS });
  if (!merchant.isActive) return NextResponse.json({ error: "Merchant disabled" }, { status: 403, headers: CORS });
  const amountCentavos = amount * 100;
  const request = await prisma.paymentRequest.create({ data: { merchantId, customerName: String(customerName), baseAmount: amountCentavos, amountCentavos, status: "pending", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), confirmationToken: "PM-" + crypto.randomBytes(6).toString("hex").toUpperCase() } });
  return NextResponse.json({ requestId: request.id, checkoutUrl: `https://paylinks-philippines.vercel.app/pay/${request.id}`, amountPesos: amount }, { headers: CORS });
}
