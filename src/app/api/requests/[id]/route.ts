import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const req = await prisma.paymentRequest.findUnique({
    where: { id },
    include: { merchant: { select: { id: true, name: true, brandName: true, gcashNumber: true, gcashName: true, gcashQr99: true, gcashQr149: true, gcashQrUrl: true } as any } },
  });
  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(req);
}
