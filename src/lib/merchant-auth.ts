import { cookies } from "next/headers";
import { prisma } from "./db";
import { hashSecret, verifySecret } from "./security";

export async function getMerchantFromCookie() {
  const store = await cookies();
  const merchantId = store.get("merchant_id")?.value;
  if (!merchantId) return null;
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant || !merchant.isActive) return null;
  return merchant;
}

/**
 * Authenticate merchant by GCash number + PIN.
 * Prefers pinHash when present; falls back to legacy plaintext pin for migration.
 */
export async function loginMerchant(gcashNumber: string, pin: string) {
  const clean = gcashNumber.replace(/\D/g, "");
  const last10 = clean.slice(-10);

  // Prefer exact match on stored number forms
  const candidates = await prisma.merchant.findMany({
    where: {
      isActive: true,
      OR: [
        { gcashNumber: clean },
        { gcashNumber: `0${last10}` },
        { gcashNumber: `63${last10}` },
        { gcashNumber: `+63${last10}` },
      ],
    },
    take: 5,
  });

  for (const m of candidates) {
    const storedNum = (m.gcashNumber || "").replace(/\D/g, "");
    if (storedNum.slice(-10) !== last10) continue;

    // New path: hashed PIN
    if ((m as any).pinHash) {
      if (verifySecret(pin, (m as any).pinHash)) return m;
      continue;
    }

    // Legacy plaintext PIN (migration window only)
    if (m.pin && m.pin === pin) {
      // Upgrade in place on successful login
      try {
        const pinHash = hashSecret(pin);
        await prisma.merchant.update({
          where: { id: m.id },
          data: { pinHash, pin: null } as any,
        });
      } catch {
        // Schema may not have pinHash yet; ignore upgrade failure
      }
      return m;
    }
  }

  return null;
}

export async function setMerchantPinHash(merchantId: string, pin: string) {
  const pinHash = hashSecret(pin);
  await prisma.merchant.update({
    where: { id: merchantId },
    data: { pinHash, pin: null } as any,
  });
}
