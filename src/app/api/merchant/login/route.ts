import { NextRequest, NextResponse } from "next/server";
import { loginMerchant } from "@/lib/merchant-auth";

export async function POST(req: NextRequest) {
  const { gcashNumber, pin } = await req.json();

  if (!gcashNumber || !pin) {
    return NextResponse.json(
      { error: "【entity-GCash¦canonical_name=GCash】 Number and PIN required" },
      { status: 400 }
    );
  }

  // Normalize: remove spaces, dashes - "0917 123 4567" -> "09171234567"
  // Also handles +63 -> 0: "+639171234567" -> "09171234567"
  let normalized = String(gcashNumber).replace(/[\s-]/g, "");
  if (normalized.startsWith("+63")) normalized = "0" + normalized.slice(3);
  if (normalized.startsWith("63") && normalized.length === 12) normalized = "0" + normalized.slice(2);

  const merchant = await loginMerchant(normalized, String(pin).trim());

  if (!merchant) {
    return NextResponse.json(
      { error: "Invalid 【entity-GCash¦canonical_name=GCash】 Number or PIN. Check and try again." },
      { status: 401 }
    );
  }

  const res = NextResponse.json({
    success: true,
    id: merchant.id,
    name: merchant.name,
    brandName: (merchant as any).brandName || merchant.name,
    gcashNumber: merchant.gcashNumber,
  });

  // Secure cookie - works on Vercel https
  res.cookies.set("merchant_id", merchant.id, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days - merchant stays logged in
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}