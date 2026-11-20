export type RequestStatus = "pending" | "paid" | "expired" | "review" | "rejected";

export type MatchResult =
  | { type: "matched"; requestId: string; by: "auto" | "ai" }
  | { type: "late_review"; requestId: string }
  | { type: "duplicate_ref" }
  | { type: "unmatched" }
  | { type: "ai_review"; requestId: string; confidence: number };

export interface CreateRequestInput {
  customerName: string;
  amountPesos: number; // e.g. 149
  externalId?: string;
  expiresInMinutes?: number; // default 15
}

export interface IngestPaymentInput {
  amountCentavos: number;
  gcashRef: string;
  senderName?: string;
  rawSms?: string;
}

export interface WebhookPayload {
  event: "payment.succeeded";
  id: string;
  amount: number;
  amountCentavos: number;
  ref: string;
  customerName: string;
  paidAt: string;
  token: string;
}

export interface AiEvidence {
  amountCentavos: number | null;
  gcashRef: string | null;
  senderName: string | null;
  paidAt: string | null;
  confidence: number;
  provider: string;
  extractedAt: string;
}