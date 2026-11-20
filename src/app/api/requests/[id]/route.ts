import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const req = await prisma.paymentRequest.findUnique({ where: { id }, include: { merchant: true } });
    if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(req);
  } catch (e: any) { return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 }); }
}
