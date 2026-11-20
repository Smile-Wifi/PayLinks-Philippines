import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSuperAdmin } from "@/lib/admin-auth";
import crypto from "crypto";
export async function GET() {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Not super admin" }, { status: 401 });
  const merchants = await prisma.merchant.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { requests: true } } } });
  // also count paid
  const withStats = await Promise.all(merchants.map(async (m:any) => {
    const paid = await prisma.paymentRequest.count({ where: { merchantId: m.id, status: "paid" } });
    const pending = await prisma.paymentRequest.count({ where: { merchantId: m.id, status: "pending" } });
    return { ...m, pin: undefined, stats: { total: m._count.requests, paid, pending } };
  }));
  return NextResponse.json(withStats);
}
export async function POST(req: NextRequest) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: "Not super admin" }, { status: 401 });
  const body = await req.json().catch(()=>null);
  if (!body?.name || !body?.gcashNumber || !body?.pin) return NextResponse.json({ error: "Name, GCash Number, PIN required" }, { status: 400 });
  let num = String(body.gcashNumber).replace(/[\s-]/g,"");
  if (num.startsWith("+63")) num = "0"+num.slice(3);
  if (num.startsWith("63") && num.length===12) num = "0"+num.slice(2);
  const existing = await prisma.merchant.findUnique({ where: { gcashNumber: num } });
  if (existing) return NextResponse.json({ error: "GCash Number already exists" }, { status: 400 });
  const m = await prisma.merchant.create({ data: {
    name: String(body.name), brandName: String(body.brandName || body.name),
    gcashNumber: num, gcashName: String(body.gcashName || body.name).toUpperCase(), pin: String(body.pin).trim(),
    apiKey: "pm_live_"+crypto.randomBytes(12).toString("hex"),
    webhookSecret: crypto.randomBytes(16).toString("hex"),
    brandEmoji: body.brandEmoji || "💰", brandColor: body.brandColor || "#0b6bff",
    brandFooter: body.brandFooter || "Thank you for your payment!",
    isActive: true,
  }});
  return NextResponse.json({ ok: true, id: m.id, name: m.name, gcashNumber: m.gcashNumber, fixedLink99: `https://paylinks-philippines.vercel.app/m/${m.id}?package=99`, fixedLink149: `https://paylinks-philippines.vercel.app/m/${m.id}?package=149` }, { status: 201 });
}
