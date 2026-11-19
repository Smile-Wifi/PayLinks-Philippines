import { NextRequest } from "next/server";
import { prisma } from "./db";

export async function requireMerchant(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const key = auth.startsWith("Bearer ")
    ? auth.slice(7).trim()
    : req.headers.get("x-api-key")?.trim();

  if (!key) {
    return { error: "Missing API key", status: 401 as const };
  }

  const merchant = await prisma.merchant.findUnique({
    where: { apiKey: key },
  });

  if (!merchant || !merchant.isActive) {
    return { error: "Invalid or inactive API key", status: 401 as const };
  }

  return { merchant };
}
