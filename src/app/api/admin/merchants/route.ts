import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSuperAdmin } from "@/lib/admin-auth";
import { generateApiKey, generateWebhookSecret } from "@/lib/crypto";
import { hashApiKey, apiKeyPrefix, hashSecret } from "@/lib/security";

export async function GET() {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Not super admin" }, { status: 401 });
  }

  const merchants = await prisma.merchant.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { requests: true } } },
  });

  const withStats = await Promise.all(
    merchants.map(async (m: any) => {
      const paid = await prisma.paymentRequest.count({
        where: { merchantId: m.id, status: "paid" },
      });
      const pending = await prisma.paymentRequest.count({
        where: { merchantId: m.id, status: "pending" },
      });
      return {
        ...m,
        pin: undefined,
        pinHash: undefined,
        apiKey: m.apiKey ? `${m.apiKey.slice(0, 12)}…` : undefined,
        apiKeyHash: undefined,
        webhookSecret: undefined,
        stats: { total: m._count.requests, paid, pending },
      };
    })
  );

  return NextResponse.json(withStats);
}

export async function POST(req: NextRequest) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Not super admin" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.gcashNumber || !body?.pin) {
    return NextResponse.json(
      { error: "Name, GCash Number, PIN required" },
      { status: 400 }
    );
  }

  let num = String(body.gcashNumber).replace(/[\s-]/g, "");
  if (num.startsWith("+63")) num = "0" + num.slice(3);
  if (num.startsWith("63") && num.length === 12) num = "0" + num.slice(2);

  const existing = await prisma.merchant.findUnique({
    where: { gcashNumber: num },
  });
  if (existing) {
    return NextResponse.json(
      { error: "GCash Number already exists" },
      { status: 400 }
    );
  }

  const pin = String(body.pin).trim();
  if (pin.length < 4 || pin.length > 12) {
    return NextResponse.json(
      { error: "PIN must be 4–12 characters" },
      { status: 400 }
    );
  }

  const rawApiKey = generateApiKey("pm_live");
  const pinHash = hashSecret(pin);

  const m = await prisma.merchant.create({
    data: {
      name: String(body.name),
      brandName: String(body.brandName || body.name),
      gcashNumber: num,
      gcashName: String(body.gcashName || body.name).toUpperCase(),
      pin: null,
      pinHash,
      apiKey: rawApiKey, // still stored for backward-compat during migration
      apiKeyHash: hashApiKey(rawApiKey),
      apiKeyPrefix: apiKeyPrefix(rawApiKey),
      webhookSecret: generateWebhookSecret(),
      brandEmoji: body.brandEmoji || "💰",
      brandColor: body.brandColor || "#0b6bff",
      brandFooter: body.brandFooter || "Thank you for your payment!",
      isActive: true,
    } as any,
  });

  // Return the raw key ONCE — it will not be shown again in list endpoints
  return NextResponse.json(
    {
      ok: true,
      id: m.id,
      name: m.name,
      gcashNumber: m.gcashNumber,
      apiKey: rawApiKey,
      fixedLink99: `https://paylinks-philippines.vercel.app/m/${m.id}?package=99`,
      fixedLink149: `https://paylinks-philippines.vercel.app/m/${m.id}?package=149`,
    },
    { status: 201 }
  );
}
