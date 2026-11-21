import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { generateSessionToken, safeEqual } from "./security";

const COOKIE_NAME = "sa_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function getAdminSecret(): string {
  const secret = process.env.SUPER_ADMIN_PASSWORD;
  if (!secret || secret.length < 12) {
    // Fail closed in production. Never fall back to a default password.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SUPER_ADMIN_PASSWORD must be set to a strong value (min 12 chars) in production"
      );
    }
    // Development only: still refuse the old default; force explicit local env.
    throw new Error(
      "SUPER_ADMIN_PASSWORD is not set or too short. Set a strong password in .env (min 12 characters)."
    );
  }
  return secret;
}

function signSession(token: string, expiresAt: number): string {
  const secret = getAdminSecret();
  const payload = `${token}.${expiresAt}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifySession(cookieValue: string): boolean {
  try {
    const parts = cookieValue.split(".");
    if (parts.length !== 3) return false;
    const [token, expStr, sig] = parts;
    const expiresAt = parseInt(expStr, 10);
    if (!token || !expiresAt || Number.isNaN(expiresAt)) return false;
    if (Date.now() > expiresAt) return false;

    const secret = getAdminSecret();
    const payload = `${token}.${expiresAt}`;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");

    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function isSuperAdmin(): Promise<boolean> {
  try {
    const store = await cookies();
    const value = store.get(COOKIE_NAME)?.value;
    if (!value) return false;
    return verifySession(value);
  } catch {
    return false;
  }
}

export function checkSuperAdminPassword(pass: string): boolean {
  try {
    const expected = getAdminSecret();
    return safeEqual(pass, expected);
  } catch {
    return false;
  }
}

/** Create a signed, time-limited admin session cookie value. */
export function createAdminSessionCookie(): {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    path: string;
    maxAge: number;
    sameSite: "strict" | "lax" | "none";
    secure: boolean;
  };
} {
  const token = generateSessionToken();
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const value = signSession(token, expiresAt);
  return {
    name: COOKIE_NAME,
    value,
    options: {
      httpOnly: true,
      path: "/",
      maxAge: MAX_AGE_SECONDS,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    },
  };
}

export function clearAdminSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      path: "/",
      maxAge: 0,
      sameSite: "strict" as const,
      secure: process.env.NODE_ENV === "production",
    },
  };
}
