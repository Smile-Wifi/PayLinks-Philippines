import { cookies } from "next/headers";
import { prisma } from "./db";

export async function getMerchantFromCookie() {
  const store = await cookies();
  const merchantId = store.get("merchant_id")?.value;
  if (!merchantId) return null;
  return prisma.merchant.findUnique({ where: { id: merchantId } });
}

export async function loginMerchant(gcashNumber: string, pin: string) {
  const clean = gcashNumber.replace(/\D/g, "");
  const last10 = clean.slice(-10);
  const all = await prisma.merchant.findMany({ where: { pin: pin.toString() } });
  const merchant = all.find(m => m.gcashNumber?.replace(/\D/g, "").slice(-10) === last10);
  return merchant || null;
}
