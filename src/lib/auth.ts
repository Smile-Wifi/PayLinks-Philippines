import { NextRequest } from "next/server";
import { prisma } from "./db";
import { hashApiKey, apiKeyPrefix } from "./security";

/**
 * Authenticate merchant via API key.
 * Supports:
 * 1. New hashed keys (apiKeyHash + apiKeyPrefix)
 * 2. Legacy plaintext apiKey column (migration window)
 */
export async function requireMerchant(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const key = auth.startsWith("Bearer ")
    ? auth.slice(7).trim()
    : req.headers.get("x-api-key")?.trim();

  if (!key || key.length < 16) {
    return { error: "Missing or invalid API key", status: 401 as const };
  }

  // Prefer hash lookup when columns exist
  const prefix = apiKeyPrefix(key);
  const keyHash = hashApiKey(key);

  let merchant =
    (await prisma.merchant.findFirst({
      where: {
        isActive: true,
        OR: [
          { apiKeyHash: keyHash } as any,
          { apiKeyPrefix: prefix, apiKeyHash: keyHash } as any,
        ],
      },
    }).catch(() => null)) || null;

  // Legacy plaintext fallback
  if (!merchant) {
    merchant = await prisma.merchant.findUnique({
      where: { apiKey: key },
    });
  }

  if (!merchant || !merchant.isActive) {
    return { error: "Invalid or inactive API key", status: 401 as const };
  }

  // Opportunistic upgrade: if still on plaintext, hash it
  if (merchant.apiKey === key && !(merchant as any).apiKeyHash) {
    try {
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: {
          apiKeyHash: keyHash,
          apiKeyPrefix: prefix,
          // Keep plaintext temporarily so existing clients keep working;
          // rotation endpoint will clear it later.
        } as any,
      });
    } catch {
      // Column may not exist yet
    }
  }

  return { merchant };
}
