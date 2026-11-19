import { prisma } from "./db";
import { generateToken, fnv1a, signPayload, formatPeso } from "./crypto";
import type { CreateRequestInput, IngestPaymentInput, MatchResult, WebhookPayload } from "./types";

const DEFAULT_EXPIRY_MINUTES = 15;
const MAX_TAG_ATTEMPTS = 99;

/**
 * Allocate a unique centavo tag for the given base amount.
 * e.g. base 149 → 14937 (₱149.37)
 * Guarantees uniqueness among currently pending requests for this merchant.
 */
async function allocateCentavoTag(
  merchantId: string,
  basePesos: number
): Promise<number> {
  const baseCentavos = Math.round(basePesos * 100);

  const pending = await prisma.paymentRequest.findMany({
    where: { merchantId, status: "pending" },
    select: { amountCentavos: true },
  });
  const used = new Set(pending.map((p) => p.amountCentavos));

  for (let attempt = 0; attempt < MAX_TAG_ATTEMPTS; attempt++) {
    const tag = 1 + Math.floor(Math.random() * 99); // 01–99
    const candidate = baseCentavos + tag;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `No free centavo tags available for ₱${basePesos}. Try a different amount or wait for pending requests to expire.`
  );
}

/**
 * Create a new payment request with a unique tagged amount.
 */
export async function createPaymentRequest(
  merchantId: string,
  input: CreateRequestInput
) {
  const amountCentavos = await allocateCentavoTag(merchantId, input.amountPesos);
  const baseAmount = Math.round(input.amountPesos * 100);
  const expiresIn = (input.expiresInMinutes ?? DEFAULT_EXPIRY_MINUTES) * 60 * 1000;

  const request = await prisma.paymentRequest.create({
    data: {
      merchantId,
      customerName: input.customerName.trim() || "Customer",
      amountCentavos,
      baseAmount,
      status: "pending",
      expiresAt: new Date(Date.now() + expiresIn),
      externalId: input.externalId,
    },
  });

  await appendAudit(merchantId, request.id, "system", "Request created", formatPeso(amountCentavos));

  return request;
}

/**
 * Core matching engine.
 * - Rejects duplicate GCash references
 * - Auto-matches exact amount to a single pending request
 * - Sends late exact payments on expired requests to review
 * - Holds everything else as unmatched
 */
export async function ingestPayment(
  merchantId: string,
  input: IngestPaymentInput
): Promise<{ result: MatchResult; message: string; paymentId?: string }> {
  // 1. Hard uniqueness on reference
  const existing = await prisma.payment.findUnique({
    where: {
      merchantId_gcashRef: { merchantId, gcashRef: input.gcashRef },
    },
  });

  if (existing) {
    await appendAudit(merchantId, null, "system", "Duplicate ref rejected", input.gcashRef);
    return { result: { type: "duplicate_ref" }, message: "Duplicate reference rejected." };
  }

  // 2. Create payment record (unmatched for now)
  const payment = await prisma.payment.create({
    data: {
      merchantId,
      gcashRef: input.gcashRef,
      amountCentavos: input.amountCentavos,
      senderName: input.senderName,
      rawSms: input.rawSms,
      matchedBy: "auto", // will update if needed
    },
  });

  // 3. Look for exact pending match
  const open = await prisma.paymentRequest.findMany({
    where: {
      merchantId,
      status: "pending",
      amountCentavos: input.amountCentavos,
    },
  });

  if (open.length === 1) {
    await markPaid(open[0].id, payment.id, "auto");
    return {
      result: { type: "matched", requestId: open[0].id, by: "auto" },
      message: `Matched to ${open[0].id} and marked paid.`,
      paymentId: payment.id,
    };
  }

  // 4. Late payment on expired request
  const late = await prisma.paymentRequest.findFirst({
    where: {
      merchantId,
      status: "expired",
      amountCentavos: input.amountCentavos,
      payment: null,
    },
  });

  if (late) {
    await prisma.paymentRequest.update({
      where: { id: late.id },
      data: { status: "review" },
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { requestId: late.id, matchedBy: "late" },
    });
    await appendAudit(
      merchantId,
      late.id,
      "system",
      "Late payment, needs review",
      input.gcashRef
    );
    return {
      result: { type: "late_review", requestId: late.id },
      message: `Matches expired ${late.id}, sent to review.`,
      paymentId: payment.id,
    };
  }

  // 5. Unmatched
  await appendAudit(
    merchantId,
    null,
    "system",
    "Unmatched payment held",
    `${formatPeso(input.amountCentavos)} ${input.gcashRef}`
  );

  return {
    result: { type: "unmatched" },
    message: "No exact match. Held as unmatched.",
    paymentId: payment.id,
  };
}

/**
 * Mark a request as paid, generate token, queue webhook.
 */
async function markPaid(
  requestId: string,
  paymentId: string,
  by: "auto" | "admin"
) {
  const token = generateToken();

  const request = await prisma.paymentRequest.update({
    where: { id: requestId },
    data: {
      status: "paid",
      confirmationToken: token,
      paidAt: new Date(),
    },
    include: { merchant: true },
  });

  await prisma.payment.update({
    where: { id: paymentId },
    data: { requestId, matchedBy: by },
  });

  await appendAudit(
    request.merchantId,
    requestId,
    by === "auto" ? "auto" : "admin",
    "Paid",
    by === "auto" ? "exact amount match" : "manual override"
  );

  // Queue signed webhook
  await queueWebhook(request);
}

/**
 * Manual approve (admin override)
 */
export async function approveRequest(
  requestId: string,
  merchantId: string,
  note: string,
  paymentId?: string
) {
  const request = await prisma.paymentRequest.findFirst({
    where: { id: requestId, merchantId },
  });
  if (!request || !["pending", "review"].includes(request.status)) {
    throw new Error("Request not open for approval");
  }
  if (!note.trim()) throw new Error("Note is required for manual decisions");

  let payId = paymentId;
  if (!payId) {
    // Create a synthetic payment if none exists
    const p = await prisma.payment.create({
      data: {
        merchantId,
        gcashRef: `manual-${Date.now()}`,
        amountCentavos: request.amountCentavos,
        matchedBy: "admin",
        requestId,
      },
    });
    payId = p.id;
  }

  await markPaid(requestId, payId, "admin");
  await appendAudit(merchantId, requestId, "admin", "Paid (manual)", `OVERRIDE: ${note}`);
}

/**
 * Reject a request
 */
export async function rejectRequest(
  requestId: string,
  merchantId: string,
  note: string
) {
  if (!note.trim()) throw new Error("Note is required");
  await prisma.paymentRequest.update({
    where: { id: requestId },
    data: { status: "rejected", notes: note },
  });
  await appendAudit(merchantId, requestId, "admin", "Rejected", note);
}

/**
 * Confirm a single-use token (staff side)
 */
export async function confirmToken(merchantId: string, token: string) {
  const request = await prisma.paymentRequest.findFirst({
    where: { merchantId, confirmationToken: token.toUpperCase() },
  });

  if (!request) return { ok: false as const, message: "Invalid token" };
  if (request.tokenConfirmedAt) {
    return {
      ok: false as const,
      message: `Already confirmed ${request.tokenConfirmedAt.toISOString()}`,
    };
  }

  await prisma.paymentRequest.update({
    where: { id: request.id },
    data: { tokenConfirmedAt: new Date() },
  });

  await appendAudit(merchantId, request.id, "merchant", "Token confirmed", token);

  return {
    ok: true as const,
    request: {
      id: request.id,
      customerName: request.customerName,
      amountCentavos: request.amountCentavos,
    },
  };
}

/**
 * Expire pending requests past their deadline (call from cron or on read)
 */
export async function expireStaleRequests(merchantId?: string) {
  const where: any = {
    status: "pending",
    expiresAt: { lt: new Date() },
  };
  if (merchantId) where.merchantId = merchantId;

  const stale = await prisma.paymentRequest.findMany({ where, select: { id: true, merchantId: true } });

  for (const r of stale) {
    await prisma.paymentRequest.update({
      where: { id: r.id },
      data: { status: "expired" },
    });
    await appendAudit(r.merchantId, r.id, "system", "Expired", null);
  }

  return stale.length;
}

/** Hash-chained audit log */
async function appendAudit(
  merchantId: string,
  requestId: string | null,
  actor: string,
  action: string,
  details: string | null
) {
  const last = await prisma.auditLog.findFirst({
    where: { merchantId },
    orderBy: { createdAt: "desc" },
    select: { hash: true },
  });

  const prevHash = last?.hash ?? "0";
  const payload = JSON.stringify({
    t: Date.now(),
    a: actor,
    o: requestId ?? "—",
    x: action,
    n: details ?? "",
  });
  const hash = fnv1a(prevHash + payload);

  await prisma.auditLog.create({
    data: {
      merchantId,
      requestId,
      actor,
      action,
      details,
      prevHash,
      hash,
    },
  });
}

/** Queue a signed webhook delivery */
async function queueWebhook(request: {
  id: string;
  merchantId: string;
  amountCentavos: number;
  customerName: string;
  confirmationToken: string | null;
  paidAt: Date | null;
  merchant: { webhookSecret: string; webhookUrl: string | null };
}) {
  const payment = await prisma.payment.findFirst({
    where: { requestId: request.id },
  });

  const body: WebhookPayload = {
    event: "payment.succeeded",
    id: request.id,
    amount: request.amountCentavos / 100,
    amountCentavos: request.amountCentavos,
    ref: payment?.gcashRef ?? "manual",
    customerName: request.customerName,
    paidAt: (request.paidAt ?? new Date()).toISOString(),
    token: request.confirmationToken ?? "",
  };

  const payload = JSON.stringify(body);
  const signature = signPayload(payload, request.merchant.webhookSecret);

  await prisma.webhookDelivery.create({
    data: {
      merchantId: request.merchantId,
      requestId: request.id,
      event: "payment.succeeded",
      payload,
      signature,
      status: request.merchant.webhookUrl ? "pending" : "pending", // still record even without URL
    },
  });

  // In production you would fire-and-forget or use a queue here.
  // For now we just store it; a separate worker can deliver.
}

/**
 * Parse a GCash-style SMS into amount + reference.
 * Handles common formats.
 */
export function parseGCashSms(sms: string): {
  amountCentavos: number;
  gcashRef: string;
  senderName?: string;
} | null {
  const amountMatch = sms.match(/(?:PHP|₱)\s?([\d,]+(?:\.\d{1,2})?)/i);
  const refMatch = sms.match(/Ref\.?\s*(?:No\.?)?\s*:?\s*(\d[\d\s]{8,})/i);

  if (!amountMatch || !refMatch) return null;

  const amountCentavos = Math.round(
    parseFloat(amountMatch[1].replace(/,/g, "")) * 100
  );
  const gcashRef = refMatch[1].replace(/\D/g, "");

  const senderMatch = sms.match(/from\s+(.+?)\s+(?:with|on|\.|,)/i);
  const senderName = senderMatch?.[1]?.trim();

  return { amountCentavos, gcashRef, senderName };
}
