import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { name, gcashNumber, gcashName, pin } = await req.json();
  if (!name || !gcashNumber || !gcashName || !pin) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }
  const apiKey = "pm_live_" + crypto.randomBytes(16).toString("hex");
  const webhookSecret = crypto.randomBytes(32).toString("hex");
  const merchant = await prisma.merchant.create({
    data: { name, brandName: name, gcashNumber, gcashName, pin: pin.toString(), apiKey, webhookSecret },
  });
  return NextResponse.json({
    success: true,
    merchant: { id: merchant.id, name: merchant.name, gcashNumber: merchant.gcashNumber, loginUrl: "/merchant/login" },
    message: `Send to merchant: Login with ${gcashNumber} / PIN ${pin}`,
  });
}

export async function GET() {
  const merchants = await prisma.merchant.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, gcashNumber: true, gcashName: true, createdAt: true },
  });
  return NextResponse.json(merchants);
}
