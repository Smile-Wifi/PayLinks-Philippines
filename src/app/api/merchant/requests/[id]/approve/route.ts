import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
const prisma = new PrismaClient();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(()=>({}));
    const action = body.action as string;
    const note = (body.note as string) || "";
    if (action !== "approve" && action !== "reject") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    const cookieStore = await cookies();
    const merchantId = cookieStore.get("merchant_id")?.value || cookieStore.get("merchantId")?.value;
    if (!merchantId) return NextResponse.json({ error: "Not logged in as merchant" }, { status: 401 });
    const payment = await prisma.paymentRequest.findFirst({ where: { id, merchantId } });
    if (!payment) return NextResponse.json({ error: "Payment not found for this merchant" }, { status: 404 });
    if (payment.status === "paid" || payment.status === "rejected") return NextResponse.json({ error: `Already ${payment.status}` }, { status: 400 });
    const updated = await prisma.paymentRequest.update({
      where: { id },
      data: { status: action === "approve" ? "paid" : "rejected", paidAt: action === "approve" ? new Date() : payment.paidAt } as any,
    });
    return NextResponse.json({ message: action === "approve" ? "Approved manually - customer can now get photos" : "Rejected", request: updated });
  } catch (e: any) {
    console.error("manual approve error", e);
    return NextResponse.json({ error: e?.message || "Approve failed" }, { status: 500 });
  }
}
