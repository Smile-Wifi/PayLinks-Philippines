import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSuperAdmin } from "@/lib/admin-auth";
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Not super admin" }, { status: 401 });
  const { id } = await params;
  // Delete child records first to avoid FK errors
  await prisma.auditLog.deleteMany({ where: { merchantId: id } });
  await prisma.webhookDelivery.deleteMany({ where: { merchantId: id } });
  await prisma.payment.deleteMany({ where: { merchantId: id } });
  await prisma.paymentRequest.deleteMany({ where: { merchantId: id } });
  await prisma.merchant.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: id });
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Not super admin" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(()=>({}));
  const data: any = {};
  if (body.name) data.name = String(body.name);
  if (body.brandName) data.brandName = String(body.brandName);
  if (body.gcashName) data.gcashName = String(body.gcashName);
  if (body.pin) data.pin = String(body.pin).trim();
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.brandColor) data.brandColor = String(body.brandColor);
  const m = await prisma.merchant.update({ where: { id }, data });
  return NextResponse.json({ ok: true, id: m.id });
}
