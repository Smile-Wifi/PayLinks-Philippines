import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/auth";
import { expireStaleRequests } from "@/lib/matching";
import { prisma } from "@/lib/db";
import { formatPeso } from "@/lib/crypto";

/** GET /api/dashboard — stats + recent activity for the merchant UI */
export async function GET(req: NextRequest) {
  const auth = await requireMerchant(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const merchantId = auth.merchant.id;
  await expireStaleRequests(merchantId);

  const [paidSum, counts, recentRequests, recentPayments, recentAudit, recentWebhooks] =
    await Promise.all([
      prisma.paymentRequest.aggregate({
        where: { merchantId, status: "paid" },
        _sum: { amountCentavos: true },
      }),
      prisma.paymentRequest.groupBy({
        by: ["status"],
        where: { merchantId },
        _count: true,
      }),
      prisma.paymentRequest.findMany({
        where: { merchantId },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { payment: true },
      }),
      prisma.payment.findMany({
        where: { merchantId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.auditLog.findMany({
        where: { merchantId },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.webhookDelivery.findMany({
        where: { merchantId },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);

  const statusMap: Record<string, number> = {};
  for (const c of counts) statusMap[c.status] = c._count;

  const unmatched = await prisma.payment.count({
    where: { merchantId, requestId: null },
  });

  return NextResponse.json({
    merchant: {
      id: auth.merchant.id,
      name: auth.merchant.name,
      brandName: auth.merchant.brandName,
      brandEmoji: auth.merchant.brandEmoji,
      brandColor: auth.merchant.brandColor,
    },
    stats: {
      collected: formatPeso(paidSum._sum.amountCentavos ?? 0),
      collectedCentavos: paidSum._sum.amountCentavos ?? 0,
      pending: statusMap["pending"] ?? 0,
      review: (statusMap["review"] ?? 0) + unmatched,
      expired: statusMap["expired"] ?? 0,
      paid: statusMap["paid"] ?? 0,
      rejected: statusMap["rejected"] ?? 0,
    },
    requests: recentRequests.map((r) => ({
      id: r.id,
      customerName: r.customerName,
      amount: formatPeso(r.amountCentavos),
      amountCentavos: r.amountCentavos,
      status: r.status,
      expiresAt: r.expiresAt,
      paidAt: r.paidAt,
      token: r.confirmationToken,
      tokenConfirmedAt: r.tokenConfirmedAt,
      payment: r.payment
        ? { ref: r.payment.gcashRef, by: r.payment.matchedBy }
        : null,
      createdAt: r.createdAt,
    })),
    payments: recentPayments.map((p) => ({
      id: p.id,
      ref: p.gcashRef,
      amount: formatPeso(p.amountCentavos),
      amountCentavos: p.amountCentavos,
      sender: p.senderName,
      matched: !!p.requestId,
      requestId: p.requestId,
      matchedBy: p.matchedBy,
      createdAt: p.createdAt,
    })),
    audit: recentAudit.map((a) => ({
      hash: a.hash,
      actor: a.actor,
      action: a.action,
      details: a.details,
      requestId: a.requestId,
      createdAt: a.createdAt,
    })),
    webhooks: recentWebhooks.map((w) => ({
      id: w.id,
      requestId: w.requestId,
      event: w.event,
      status: w.status,
      signature: w.signature.slice(0, 24) + "…",
      createdAt: w.createdAt,
    })),
  });
}
