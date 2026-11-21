import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 32;

/** Hash a secret (PIN or API key material) with scrypt. Returns "scrypt$salt$hash". */
export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(secret, salt, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

/** Constant-time verification of a secret against a stored hash. */
export function verifySecret(secret: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") return false;
    const [, salt, hashHex] = parts;
    const expected = Buffer.from(hashHex, "hex");
    const derived = scryptSync(secret, salt, expected.length, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** SHA-256 hex of a full API key (for storage). */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

/** Extract prefix used for lookup (e.g. "pm_live_a1b2c3d4"). */
export function apiKeyPrefix(apiKey: string): string {
  // Keep first 16 chars after scheme for indexed lookup
  if (apiKey.startsWith("pm_live_") || apiKey.startsWith("pm_test_")) {
    return apiKey.slice(0, 16);
  }
  return apiKey.slice(0, 12);
}

/** Generate a cryptographically strong session token. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/** Constant-time string equality. */
export function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
