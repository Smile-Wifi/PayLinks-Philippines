import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMerchant } from "@/lib/auth";
import { approveRequest, rejectRequest } from "@/lib/matching";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().min(1).max(500),
  paymentId: z.string().optional(),
});

/** POST /api/requests/:id/actions — admin approve / reject */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMerchant(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    if (parsed.data.action === "approve") {
      await approveRequest(id, auth.merchant.id, parsed.data.note, parsed.data.paymentId);
      return NextResponse.json({ ok: true, message: "Request approved and marked paid" });
    } else {
      await rejectRequest(id, auth.merchant.id, parsed.data.note);
      return NextResponse.json({ ok: true, message: "Request rejected" });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
