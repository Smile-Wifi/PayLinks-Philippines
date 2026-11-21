# Security Hardening (P0)

## Changes in `security/p0-hardening`

### 1. Super Admin
- **No default password.** `SUPER_ADMIN_PASSWORD` is required (min 12 characters).
- Session is a signed, time-limited HMAC cookie (`sa_session`), not a plain `super_admin=yes` flag.
- Login is rate-limited (5 attempts / 15 minutes per IP).

### 2. Merchant Login
- Rate-limited (8 attempts / 15 minutes per IP).
- PIN is stored as scrypt hash (`pinHash`). Legacy plaintext `pin` is upgraded on successful login and then cleared.
- Lookup is scoped by GCash number forms; no longer loads all merchants with a matching PIN.

### 3. API Keys
- New columns: `apiKeyHash` (SHA-256), `apiKeyPrefix`.
- Auth prefers hash lookup; legacy plaintext still accepted during migration and is opportunistically hashed.
- Admin merchant list no longer returns full API keys or webhook secrets.

### 4. AI Screenshot Auto-Approve
- **Disabled by default.**
- To enable: set `AI_AUTO_APPROVE=true` and optionally `AI_AUTO_THRESHOLD=92` (default 92).
- Without the flag, screenshots always go to `review` (or stay pending on low confidence).

### 5. Rate Limiting
- Admin login, merchant login, and payment ingest endpoints are rate-limited.
- In-memory limiter is suitable for single-region; replace with Redis/Upstash for multi-region production.

### 6. Idempotency
- `PaymentRequest.idempotencyKey` and `Payment.idempotencyKey` supported.
- Create and ingest accept optional `idempotencyKey`.

## Required Environment Variables

```
SUPER_ADMIN_PASSWORD=<strong-password-min-12-chars>
DATABASE_URL=...
# Optional:
AI_AUTO_APPROVE=false
AI_AUTO_THRESHOLD=92
```

## Migration Steps

1. Deploy this branch (or merge after review).
2. Run `npx prisma db push` (or a proper migration) to add the new columns.
3. Set `SUPER_ADMIN_PASSWORD` in Vercel — **do not leave it unset**.
4. Create new merchants via admin so they get hashed PINs and hashed API keys.
5. Existing merchants: next successful PIN login upgrades `pinHash` and clears plaintext `pin`.
6. Rotate API keys for high-value merchants when ready (clear plaintext `apiKey` after all clients use the new key).

## Remaining Work (not in this PR)
- Full webhook delivery worker + retries
- Redis-backed rate limiting
- Key rotation endpoint
- Ledger / financial events
- RLS if moving to Supabase with multi-tenant DB roles
