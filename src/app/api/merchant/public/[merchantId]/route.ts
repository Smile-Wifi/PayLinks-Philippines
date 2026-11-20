import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export async function GET(_req: Request, { params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const m = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true, name: true, brandName: true, brandEmoji: true, brandColor: true } });
  if (!m) return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  return NextResponse.json(m);
}
