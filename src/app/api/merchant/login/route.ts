import { NextRequest, NextResponse } from "next/server";
import { loginMerchant } from "@/lib/merchant-auth";
export async function POST(req: NextRequest) {
  const { gcashNumber, pin } = await req.json();
  const merchant = await loginMerchant(gcashNumber, pin);
  if (!merchant) return NextResponse.json({ error: "Invalid" }, { status: 401 });
  const res = NextResponse.json({ success: true, name: merchant.name });
  res.cookies.set("merchant_id", merchant.id, { httpOnly: true, path: "/" });
  return res;
}
