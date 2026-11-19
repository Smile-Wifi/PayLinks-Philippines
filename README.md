# PesoMatch Gateway

Production-oriented GCash payment matching gateway using **unique centavo tags**.

Instead of asking customers to type a 13-digit reference, the gateway assigns a unique amount (e.g. ₱149.37 instead of ₱149.00). When the SMS arrives, the exact amount uniquely identifies the request.

## Features

- Unique centavo tagging (01–99) with collision avoidance
- Server-side matching engine with hard uniqueness on GCash refs
- State machine: `pending → paid | expired | review | rejected`
- Hash-chained audit trail (tamper-evident)
- HMAC-SHA256 signed webhooks (`payment.succeeded`)
- Single-use confirmation tokens + branded receipts
- SMS parsing (structured or raw GCash text)
- Merchant API-key auth
- Admin approve / reject with mandatory notes
- Clean merchant dashboard + customer checkout page

## Quick start

```bash
# 1. Install
npm install

# 2. Create database
npx prisma db push

# 3. Seed demo merchant
npm run db:seed

# 4. Run
npm run dev
```

Open http://localhost:3000 and paste the API key printed by the seed script.

## API overview

All endpoints require:

```
Authorization: Bearer pm_test_…
```

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/requests` | Create payment request |
| GET | `/api/requests` | List requests |
| POST | `/api/payments/ingest` | Ingest SMS / payment signal |
| POST | `/api/tokens/confirm` | Staff confirms single-use token |
| POST | `/api/requests/:id/actions` | Approve / reject |
| GET | `/api/dashboard` | Full dashboard payload |

### Create request

```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Ana S.","amountPesos":299}'
```

Response includes the exact tagged amount and a checkout URL.

### Ingest payment (from your SMS forwarder)

```bash
curl -X POST http://localhost:3000/api/payments/ingest \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"rawSms":"You have received PHP 299.47 from ANA S. Ref No. 1234567890123."}'
```

Or structured:

```json
{
  "amountCentavos": 29947,
  "gcashRef": "1234567890123",
  "senderName": "ANA S."
}
```

## Going to production

1. **Database** — Switch Prisma to PostgreSQL (Neon, Supabase, Vercel Postgres).
2. **SMS ingestion** — Run a small authenticated service on the phone that receives GCash notifications and POSTs to `/api/payments/ingest`. Never expose this endpoint publicly without device attestation or IP allow-list.
3. **Webhook delivery** — Add a background worker that retries `WebhookDelivery` rows with status `pending`.
4. **GCash for Business / licensed partner** — Personal GCash has no public API. Treat this app as the reconciliation layer on top of a proper channel.
5. **Unique constraints** — The schema already has uniqueness on `(merchantId, gcashRef)`. For pending tags, the matching engine enforces uniqueness in application code; you can add a partial unique index in Postgres if desired.
6. **Secrets** — Rotate API keys and webhook secrets regularly. Store them in a secret manager.

## Project structure

```
prisma/
  schema.prisma          # Database models
  seed.ts                # Demo merchant
src/
  lib/
    matching.ts          # Core matching engine
    crypto.ts            # HMAC, tokens, hash chain
    auth.ts              # API key middleware
    db.ts                # Prisma client
  app/
    page.tsx             # Merchant dashboard
    pay/[id]/page.tsx    # Customer checkout
    api/                 # REST endpoints
```

## License

MIT — use freely.
