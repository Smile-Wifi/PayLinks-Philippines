export type RequestStatus = "pending" | "paid" | "expired" | "review" | "rejected";

export type MatchResult =
  | { type: "matched"; requestId: string; by: "auto" }
  | { type: "late_review"; requestId: string }
  | { type: "duplicate_ref" }
  | { type: "unmatched" };

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
