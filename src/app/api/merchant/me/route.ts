import { NextResponse } from "next/server";
import { getMerchantFromCookie } from "@/lib/merchant-auth";
export async function GET() {
  const m = await getMerchantFromCookie();
  if (!m) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  return NextResponse.json({ id: m.id, name: m.name, brandName: (m as any).brandName || m.name, gcashNumber: m.gcashNumber, gcashName: (m as any).gcashName || "", gcashQr99: (m as any).gcashQr99 || "", gcashQr149: (m as any).gcashQr149 || "", gcashQrUrl: (m as any).gcashQrUrl || "" });
}
