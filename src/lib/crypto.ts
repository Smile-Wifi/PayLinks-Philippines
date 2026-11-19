import { createHmac, randomBytes } from "crypto";

/** FNV-1a 32-bit hash (compatible with original demo) */
export function fnv1a(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** HMAC-SHA256 signature for webhooks */
export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Generate a single-use confirmation token like PM-A1B2-C3D4-E5F6 */
export function generateToken(): string {
  const bytes = randomBytes(6);
  const hex = bytes.toString("hex").toUpperCase();
  return `PM-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

/** Generate a secure API key */
export function generateApiKey(prefix: "pm_live" | "pm_test" = "pm_test"): string {
  return `${prefix}_${randomBytes(24).toString("hex")}`;
}

/** Generate webhook secret */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

/** Format centavos as Philippine peso */
export function formatPeso(centavos: number): string {
  return (
    "₱" +
    (centavos / 100).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
