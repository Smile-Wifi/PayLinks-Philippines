import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getMerchantFromCookie } from "@/lib/merchant-auth";
export async function GET() {
  const m = await getMerchantFromCookie();
  if (!m) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const full: any = await prisma.merchant.findUnique({ where: { id: m.id } });
  return NextResponse.json({ brandName: full.brandName||"", brandEmoji: full.brandEmoji||"", brandColor: full.brandColor||"", brandFooter: full.brandFooter||"", checkoutTitle: full.checkoutTitle||"", checkoutSubtitle: full.checkoutSubtitle||"", checkoutSteps: full.checkoutSteps||"", logoUrl: full.logoUrl||"" });
}
export async function POST(req: NextRequest) {
  const m = await getMerchantFromCookie();
  if (!m) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const b = await req.json().catch(()=>({}));
  const data: any = {};
  if (typeof b.brandName==="string") data.brandName = b.brandName.slice(0,60);
  if (typeof b.brandEmoji==="string") data.brandEmoji = b.brandEmoji.slice(0,10);
  if (typeof b.brandColor==="string") data.brandColor = b.brandColor.slice(0,20);
  if (typeof b.brandFooter==="string") data.brandFooter = b.brandFooter.slice(0,200);
  if (typeof b.checkoutTitle==="string") data.checkoutTitle = b.checkoutTitle.slice(0,80);
  if (typeof b.checkoutSubtitle==="string") data.checkoutSubtitle = b.checkoutSubtitle.slice(0,200);
  if (typeof b.checkoutSteps==="string") data.checkoutSteps = b.checkoutSteps.slice(0,1000);
  if (typeof b.logoUrl==="string") data.logoUrl = b.logoUrl.slice(0,500);
  await prisma.merchant.update({ where: { id: m.id }, data });
  return NextResponse.json({ ok: true, message: "Design saved! Your pay page updates instantly." });
}
