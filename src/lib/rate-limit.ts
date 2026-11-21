/**
 * Lightweight in-memory sliding-window rate limiter.
 * Suitable for single-region Vercel serverless with care.
 * For multi-region production, replace with Redis/Upstash.
 */

type Entry = { timestamps: number[] };

const store = new Map<string, Entry>();

const CLEAN_INTERVAL_MS = 60_000;
let lastClean = Date.now();

function cleanup(now: number) {
  if (now - lastClean < CLEAN_INTERVAL_MS) return;
  lastClean = now;
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * @param key - unique key (e.g. `ip:1.2.3.4:admin-login` or `merchant:abc:ingest`)
 * @param limit - max requests in the window
 * @param windowMs - window size in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: Math.max(0, limit - entry.timestamps.length),
    retryAfterSeconds: 0,
  };
}

export function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
