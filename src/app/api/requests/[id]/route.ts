import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Accept" };
export async function OPTIONS() { return new Response(null, { headers: CORS }); }
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const req = await prisma.paymentRequest.findUnique({ where: { id }, include: { merchant: true } });
    if (!req) return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });
    return NextResponse.json(req, { headers: CORS });
  } catch (e: any) { return NextResponse.json({ error: e?.message || "Server error" }, { status: 500, headers: CORS }); }
}
