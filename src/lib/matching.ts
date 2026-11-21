import { prisma } from "./db";
import { generateToken, fnv1a, signPayload, formatPeso } from "./crypto";
import { extractFromSms } from "./ai";
import type {
  CreateRequestInput,
  IngestPaymentInput,
  MatchResult,
  WebhookPayload,
  AiEvidence,
} from "./types";

const DEFAULT_EXPIRY_MINUTES = 15;
const MAX_TAG_ATTEMPTS = 99;

/** Auto-approve only when explicitly enabled AND confidence is high. Default: review only. */
const AI_AUTO_APPROVE_ENABLED =
  process.env.AI_AUTO_APPROVE === "true" || process.env.AI_AUTO_APPROVE === "1";
const AI_AUTO_THRESHOLD = Number(process.env.AI_AUTO_THRESHOLD || "92");

/**
 * Allocate a unique centavo tag for the given base amount.
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
  input: CreateRequestInput & { idempotencyKey?: string }
) {
  if (input.idempotencyKey) {
    const existing = await prisma.paymentRequest.findFirst({
      where: {
        merchantId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (existing) return existing;
  }

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
      idempotencyKey: input.idempotencyKey,
    },
  });

  await appendAudit(
    merchantId,
    request.id,
    "system",
    "Request created",
    formatPeso(amountCentavos)
  );

  return request;
}

/**
 * Core matching engine
 */
export async function ingestPayment(
  merchantId: string,
  input: IngestPaymentInput & { idempotencyKey?: string }
): Promise<{ result: MatchResult; message: string; paymentId?: string }> {
  // Idempotency: same key returns previous outcome without double-processing
  if (input.idempotencyKey) {
    const prior = await prisma.payment.findFirst({
      where: { merchantId, idempotencyKey: input.idempotencyKey },
    });
    if (prior) {
      return {
        result: prior.requestId
          ? { type: "matched", requestId: prior.requestId, by: "auto" }
          : { type: "unmatched" },
        message: "Idempotent replay",
        paymentId: prior.id,
      };
    }
  }

  // 1. Hard uniqueness on reference
  const existing = await prisma.payment.findUnique({
    where: {
      merchantId_gcashRef: { merchantId, gcashRef: input.gcashRef },
    },
  });

  if (existing) {
    await appendAudit(
      merchantId,
      null,
      "system",
      "Duplicate ref rejected",
      input.gcashRef
    );
    return { result: { type: "duplicate_ref" }, message: "Duplicate reference rejected." };
  }

  // 2. Create payment record
  const payment = await prisma.payment.create({
    data: {
      merchantId,
      gcashRef: input.gcashRef,
      amountCentavos: input.amountCentavos,
      senderName: input.senderName,
      rawSms: input.rawSms,
      matchedBy: "auto",
      idempotencyKey: input.idempotencyKey,
    },
  });

  // 3. Exact pending match
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

  // 4. Late payment on expired
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
 * Validate payment from customer-uploaded screenshot (AI).
 * Default policy: never auto-mark paid. Requires AI_AUTO_APPROVE=true + high confidence.
 */
export async function validateWithScreenshot(
  requestId: string,
  imageBase64: string,
  mimeType = "image/jpeg"
): Promise<{
  ok: boolean;
  status: "paid" | "review" | "rejected" | "pending";
  message: string;
  confidence: number;
  extraction: any;
}> {
  const request = await prisma.paymentRequest.findUnique({
    where: { id: requestId },
    include: { merchant: true, payment: true },
  });

  if (!request) {
    return {
      ok: false,
      status: "rejected",
      message: "Request not found",
      confidence: 0,
      extraction: null,
    };
  }

  if (request.status === "paid") {
    return {
      ok: true,
      status: "paid",
      message: "Already paid",
      confidence: 100,
      extraction: null,
    };
  }

  if (!["pending", "review", "expired"].includes(request.status)) {
    return {
      ok: false,
      status: request.status as any,
      message: `Cannot validate in status: ${request.status}`,
      confidence: 0,
      extraction: null,
    };
  }

  const { extractFromScreenshot } = await import("./ai");
  const extraction = await extractFromScreenshot(imageBase64, mimeType);

  const evidence: AiEvidence = {
    amountCentavos: extraction.amountCentavos,
    gcashRef: extraction.gcashRef,
    senderName: extraction.senderName,
    paidAt: extraction.paidAt,
    confidence: extraction.confidence,
    provider: extraction.provider,
    extractedAt: new Date().toISOString(),
  };

  await prisma.paymentRequest.update({
    where: { id: requestId },
    data: {
      notes: JSON.stringify(evidence),
      customerEvidence: extraction.gcashRef || undefined,
    },
  });

  const amountMatch =
    extraction.amountCentavos !== null &&
    extraction.amountCentavos === request.amountCentavos;

  // Auto-approve is OFF by default. Only when explicitly enabled and high confidence.
  const canAutoApprove =
    AI_AUTO_APPROVE_ENABLED &&
    amountMatch &&
    extraction.confidence >= AI_AUTO_THRESHOLD &&
    !!extraction.gcashRef;

  if (canAutoApprove) {
    let paymentId = request.payment?.id;
    if (!paymentId) {
      const p = await prisma.payment.create({
        data: {
          merchantId: request.merchantId,
          gcashRef: extraction.gcashRef!,
          amountCentavos: request.amountCentavos,
          senderName: extraction.senderName,
          matchedBy: "ai",
          requestId,
        },
      });
      paymentId = p.id;
    } else {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { matchedBy: "ai" },
      });
    }

    await markPaid(requestId, paymentId, "ai");
    await appendAudit(
      request.merchantId,
      requestId,
      "ai",
      "Paid (AI screenshot)",
      `confidence ${extraction.confidence}% | ref ${extraction.gcashRef}`
    );

    return {
      ok: true,
      status: "paid",
      message: "Payment verified automatically. Thank you!",
      confidence: extraction.confidence,
      extraction,
    };
  }

  // Default path: human review
  if (extraction.confidence >= 40 || amountMatch) {
    await prisma.paymentRequest.update({
      where: { id: requestId },
      data: { status: "review" },
    });
    await appendAudit(
      request.merchantId,
      requestId,
      "ai",
      "Needs review (AI)",
      `confidence ${extraction.confidence}% | amountMatch=${amountMatch} | auto=${AI_AUTO_APPROVE_ENABLED}`
    );

    return {
      ok: true,
      status: "review",
      message:
        "We received your screenshot. It is under review. You will be notified shortly.",
      confidence: extraction.confidence,
      extraction,
    };
  }

  return {
    ok: false,
    status: "pending",
    message:
      "Could not clearly read the receipt. Please make sure the amount and reference number are visible, or contact the merchant.",
    confidence: extraction.confidence,
    extraction,
  };
}

async function markPaid(
  requestId: string,
  paymentId: string,
  by: "auto" | "admin" | "ai"
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
    by === "auto" ? "auto" : by === "ai" ? "ai" : "admin",
    "Paid",
    by === "auto"
      ? "exact amount match"
      : by === "ai"
      ? "AI screenshot verification"
      : "manual override"
  );

  await queueWebhook(request);
}

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
  await appendAudit(
    merchantId,
    requestId,
    "admin",
    "Paid (manual)",
    `OVERRIDE: ${note}`
  );
}

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

export async function expireStaleRequests(merchantId?: string) {
  const where: any = {
    status: "pending",
    expiresAt: { lt: new Date() },
  };
  if (merchantId) where.merchantId = merchantId;

  const stale = await prisma.paymentRequest.findMany({
    where,
    select: { id: true, merchantId: true },
  });

  for (const r of stale) {
    await prisma.paymentRequest.update({
      where: { id: r.id },
      data: { status: "expired" },
    });
    await appendAudit(r.merchantId, r.id, "system", "Expired", null);
  }

  return stale.length;
}

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
      status: "pending",
      nextAttempt: new Date(),
    },
  });
}

export async function parseGCashSms(sms: string) {
  const result = await extractFromSms(sms);
  if (result.amountCentavos && result.gcashRef) {
    return {
      amountCentavos: result.amountCentavos,
      gcashRef: result.gcashRef,
      senderName: result.senderName || undefined,
    };
  }
  return null;
}
