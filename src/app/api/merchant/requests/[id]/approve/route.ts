import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getMerchantFromCookie } from "@/lib/merchant-auth";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const merchant = await getMerchantFromCookie();
  if (!merchant) return NextResponse.json({ error: "Not logged in as merchant" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(()=>({}));
  const action = body.action || "approve"; // approve | reject
  const note = body.note || "";
  const reqData = await prisma.paymentRequest.findUnique({ where: { id }, include: { payment: true } });
  if (!reqData) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (reqData.merchantId !== merchant.id) return NextResponse.json({ error: "Not your payment" }, { status: 403 });
  if (reqData.status === "paid" && action === "approve") return NextResponse.json({ ok: true, status: "paid", message: "Already paid" });
  if (action === "approve") {
    // If no payment record yet (customer paid cash / manual), create one with merchant manual ref
    let paymentId = reqData.payment?.id;
    const ref = body.gcashRef || `MANUAL-${reqData.id.slice(-6).toUpperCase()}`;
    if (!paymentId) {
      const p = await prisma.payment.create({ data: { merchantId: merchant.id, gcashRef: ref, amountCentavos: reqData.amountCentavos, senderName: reqData.customerName, matchedBy: "manual-merchant", requestId: id } });
      paymentId = p.id;
    } else {
      await prisma.payment.update({ where: { id: paymentId }, data: { matchedBy: "manual-merchant", requestId: id } });
    }
    await prisma.paymentRequest.update({ where: { id }, data: { status: "paid", paidAt: new Date(), notes: note ? `Manual approved by merchant: ${note}` : "Manual approved by merchant" } });
    return NextResponse.json({ ok: true, status: "paid", message: "✅ Manually approved. Customer can now get photos." });
  }
  // reject
  await prisma.paymentRequest.update({ where: { id }, data: { status: "rejected", notes: note ? `Rejected by merchant: ${note}` : "Rejected by merchant" } });
  return NextResponse.json({ ok: true, status: "rejected", message: "Payment rejected." });
}
