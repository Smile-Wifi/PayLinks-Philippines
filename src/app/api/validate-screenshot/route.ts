import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyWithDualAI } from "@/lib/ai-dual";
export async function POST(req: NextRequest) {
  try {
    const { requestId, imageBase64, mimeType } = await req.json();
    if (!requestId || !imageBase64) return NextResponse.json({ error: "requestId and imageBase64 required" }, { status: 400 });
    const request = await prisma.paymentRequest.findUnique({ where: { id: requestId }, include: { merchant: true, payment: true } });
    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (request.status === "paid") return NextResponse.json({ ok: true, status: "paid", message: "Already paid" });
    const dual = await verifyWithDualAI(imageBase64, mimeType || "image/jpeg", request.amountCentavos);
    await prisma.paymentRequest.update({ where: { id: requestId }, data: { notes: JSON.stringify({ dual, checkedAt: new Date().toISOString() }), customerEvidence: dual.finalRef || undefined } });
    if (dual.autoApprove && dual.finalRef) {
      let paymentId = request.payment?.id;
      if (!paymentId) { const p = await prisma.payment.create({ data: { merchantId: request.merchantId, gcashRef: dual.finalRef, amountCentavos: request.amountCentavos, senderName: dual.gemini?.senderName || undefined, matchedBy: "dual-ai", requestId } }); paymentId = p.id; }
      await prisma.paymentRequest.update({ where: { id: requestId }, data: { status: "paid", paidAt: new Date() } });
      await prisma.payment.update({ where: { id: paymentId }, data: { requestId, matchedBy: "dual-ai" } });
      return NextResponse.json({ ok: true, status: "paid", message: "Verified by BOTH AIs. Thank you!", dual });
    }
    await prisma.paymentRequest.update({ where: { id: requestId }, data: { status: "review" } });
    return NextResponse.json({ ok: true, status: "review", message: "AIs did not fully agree / low confidence. Under manual review.", dual });
  } catch (e: any) { return NextResponse.json({ error: e?.message || "Validation failed" }, { status: 500 }); }
}
