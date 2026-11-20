import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getMerchantFromCookie } from "@/lib/merchant-auth";

// POST { package: "99" | "149", imageBase64, mimeType } -> saves QR to merchant
export async function POST(req: NextRequest) {
  const merchant = await getMerchantFromCookie();
  if (!merchant) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { package: pkg, imageBase64, mimeType } = await req.json();
  if (!pkg || !["99","149"].includes(String(pkg))) return NextResponse.json({ error: "package must be 99 or 149" }, { status: 400 });
  if (!imageBase64) return NextResponse.json({ error: "image required" }, { status: 400 });
  if (imageBase64.length > 2_000_000) return NextResponse.json({ error: "Image too big. Use screenshot under 2MB" }, { status: 400 });
  const dataUrl = `data:${mimeType || "image/png"};base64,${imageBase64}`;
  const field = pkg === "99" ? "gcashQr99" : "gcashQr149";
  await prisma.merchant.update({ where: { id: merchant.id }, data: { [field]: dataUrl } as any });
  return NextResponse.json({ ok: true, package: pkg, message: `QR for P${pkg} saved` });
}
