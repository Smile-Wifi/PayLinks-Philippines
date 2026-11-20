import { NextResponse } from "next/server";
import { getMerchantFromCookie } from "@/lib/merchant-auth";
export async function GET() {
  const m = await getMerchantFromCookie();
  if (!m) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  return NextResponse.json({ id: m.id, name: m.name, gcashNumber: m.gcashNumber });
}
