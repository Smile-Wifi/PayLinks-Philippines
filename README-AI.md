# PesoMatch AI Auto / Semi-Auto Validation Upgrade

This package adds **AI-powered auto & semi-auto validation** for GCash payments.

### What it does
- Customer can upload GCash screenshot after paying
- AI (Meta Muse or Google Gemini free) extracts: amount, Ref No., sender, date
- Exact amount match + high AI confidence → **auto mark as paid**
- Medium confidence → goes to **review** with AI suggestion
- Also improves SMS parsing with AI fallback

### Free / Cheap options supported
1. **Google Gemini 2.5 Flash** (recommended free tier – very generous)
2. **Meta Muse Spark** (your postpaid Meta Model API)
3. Fallback to rule-based parser if no AI key

---

## Installation (5 minutes)

1. Copy the files from this zip into your project (overwrite when asked):

```
src/lib/ai.ts                  ← new
src/lib/matching.ts            ← updated
src/lib/types.ts               ← updated
src/app/pay/[id]/page.tsx      ← updated (customer upload UI)
src/app/api/payments/validate-screenshot/route.ts  ← new
prisma/schema.prisma           ← updated (additive fields)
```

2. Install nothing extra (uses native `fetch`).

3. Add these to your `.env`:

```env
# Choose one or both
GEMINI_API_KEY=your_gemini_key_here          # Free from https://aistudio.google.com/apikey
META_MUSE_API_KEY=your_meta_muse_key_here    # Your postpaid Meta Model API key

# Optional: force which provider to prefer
AI_PROVIDER=gemini   # or "muse" or "auto" (default)
```

4. Push the schema changes:

```bash
npx prisma db push
```

5. Restart the app:

```bash
npm run dev
```

---

## How it works (Customer flow)

1. Merchant creates payment request → unique amount (e.g. ₱149.37)
2. Customer opens `/pay/[id]`
3. Customer sends exact amount via GCash
4. Customer clicks **“I already paid – Upload Screenshot”**
5. Uploads the GCash receipt screenshot
6. AI extracts the data
7. System decides:
   - High confidence + exact amount → **Paid** automatically + confirmation token shown
   - Medium → status becomes **review** (merchant sees AI suggestion)
   - Low / mismatch → stays pending or rejected with message

---

## Merchant side

In the dashboard you will see:
- AI confidence score
- Extracted Ref No. and amount
- Suggested action

You can still manually Approve / Reject as before.

---

## Notes

- Screenshots are processed in memory and **not stored** (privacy-friendly).
- Only the AI extraction result + confidence is saved in the database.
- Works even if SMS forwarder is down.
- Unique centavo tag remains the strongest signal.

---

Created for your PesoMatch Gateway project.  
Just follow the steps above and you’re good.