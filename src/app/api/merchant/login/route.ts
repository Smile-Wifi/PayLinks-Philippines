import { NextRequest, NextResponse } from "next/server";
import { loginMerchant } from "@/lib/merchant-auth";
export async function POST(req: NextRequest) {
  const { gcashNumber, pin } = await req.json();
  if (!gcashNumber || !pin) return NextResponse.json({ error: "GCash Number and PIN required" }, { status: 400 });
  let normalized = String(gcashNumber).replace(/[\s-]/g, "");
  if (normalized.startsWith("+63")) normalized = "0" + normalized.slice(3);
  if (normalized.startsWith("63") && normalized.length === 12) normalized = "0" + normalized.slice(2);
  const merchant = await loginMerchant(normalized, String(pin).trim());
  if (!merchant) return NextResponse.json({ error: "Invalid GCash Number or PIN" }, { status: 401 });
  const res = NextResponse.json({ success: true, id: merchant.id, name: merchant.name, brandName: (merchant as any).brandName || merchant.name, gcashNumber: merchant.gcashNumber });
  res.cookies.set("merchant_id", merchant.id, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
}
