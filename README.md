# AutoBooks — Quad 4 Consulting Services

Phase 1 client portal: clients upload documents, Satish reviews and approves,
approved items auto-push to QuickBooks, clients see their financial dashboard.

## Stack

Next.js 14 · TypeScript · Tailwind · Clerk · Supabase · QuickBooks Online ·
Plaid · Resend · Recharts · react-pdf.

## Getting started

```bash
cp .env.example .env.local
# fill in keys
npm install
npm run dev
```

Apply the SQL migration in `supabase/migrations/0001_initial_schema.sql`
to your Supabase project. Create two private storage buckets:
`client-documents` and `client-reports`.

## Subdomains

- `admin.quad4consulting.com` — Satish admin panel
- `{slug}.quad4consulting.com` — each client's portal
- Wildcard domain `*.quad4consulting.com` must be configured in Vercel

Local development can use `localhost` and `admin.localhost`,
`garageking.localhost` via your hosts file.

## Scripts

- `npm run dev` — start Next dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript

## Cron jobs (Vercel)

Configured in `vercel.json`:
- Daily Plaid transaction sync (6 AM UTC)
- QuickBooks token refresh every 6 hours

Both endpoints require `Authorization: Bearer ${CRON_SECRET}`.

## Promoting the admin account

In Clerk dashboard, locate Satish's user, edit Public Metadata to:

```json
{ "role": "admin" }
```

Client users are created automatically through the admin "Add new client"
flow, which sets `publicMetadata.role = "client"` and `clientId = "<uuid>"`.

## Security

- Token encryption (QB + Plaid): AES-256-GCM via `TOKEN_ENCRYPTION_KEY`
  (32 bytes, base64).
- All Supabase buckets are private — files are served via 1-hour signed URLs.
- RLS policies restrict each client to its own rows; admin uses service role.
- File uploads validated against magic bytes (not just extension) using
  `file-type`.

## Out of scope (Phase 1)

Payroll calc, tax filing, invoice creation, payments, mobile app, OCR,
multi-currency. See `CLAUDE.md` for the full list.
