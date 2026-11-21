import { NextRequest, NextResponse } from "next/server";
import { loginMerchant } from "@/lib/merchant-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`merchant-login:${ip}`, 8, 15 * 60 * 1000); // 8 / 15 min

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      }
    );
  }

  let body: { gcashNumber?: string; pin?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.gcashNumber || !body.pin) {
    return NextResponse.json(
      { error: "GCash Number and PIN required" },
      { status: 400 }
    );
  }

  let normalized = String(body.gcashNumber).replace(/[\s-]/g, "");
  if (normalized.startsWith("+63")) normalized = "0" + normalized.slice(3);
  if (normalized.startsWith("63") && normalized.length === 12) {
    normalized = "0" + normalized.slice(2);
  }

  const pin = String(body.pin).trim();
  if (pin.length < 4 || pin.length > 12) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const merchant = await loginMerchant(normalized, pin);
  if (!merchant) {
    return NextResponse.json(
      { error: "Invalid GCash Number or PIN" },
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

  res.cookies.set("merchant_id", merchant.id, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}
