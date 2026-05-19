# CLAUDE.md — Quad 4 Consulting Services / AutoBooks Phase 1

See the full product specification in this file; it is the authoritative source for all features, schema, and constraints.

This is a Next.js 14 (App Router) + TypeScript application implementing the AutoBooks Client Portal:

- Subdomain routing: `admin.quad4consulting.com` for the admin app; `{slug}.quad4consulting.com` for each client portal.
- Auth via Clerk; roles set in `publicMetadata` (`admin` / `client` + `clientId`).
- Postgres via Supabase, RLS enforced; service role used in server code only.
- Document storage via private Supabase Storage bucket with signed URLs.
- QuickBooks Online via OAuth 2.0 + Reports API; tokens encrypted at rest (AES-256-GCM).
- Plaid for bank connections; tokens encrypted at rest.
- Resend for transactional emails; react-pdf for downloadable reports.

## Folder layout

```
app/                          Next.js routes (portal + admin + API)
  portal/[slug]/...           Client-facing pages, accessed via subdomain rewrite
  admin/...                   Admin (Satish) pages
  api/...                     REST endpoints
components/                   UI components (portal/, admin/, shared/)
lib/                          Server helpers (supabase/, quickbooks/, plaid/, resend/, encryption/, auth/, utils/)
supabase/migrations/          Database schema and RLS policies
middleware.ts                 Subdomain detection + auth gating
types/index.ts                Shared TypeScript types
```

## Running locally

1. Copy `.env.example` to `.env.local` and fill in real credentials.
2. Run `npm install` then `npm run dev`.
3. Apply `supabase/migrations/0001_initial_schema.sql` to your Supabase project.
4. Create two private Storage buckets in Supabase: `client-documents` and `client-reports`.
5. In Clerk: create a development instance, enable email+password, and set the redirect URL to `/sign-in`.
6. Promote your own account by setting `publicMetadata.role = "admin"` via the Clerk dashboard.

## Constraints

- TypeScript strict mode, no `any`.
- All DB calls live in `lib/supabase/queries.ts`.
- All QB API calls live in `lib/quickbooks/*`.
- All Plaid API calls live in `lib/plaid/*`.
- Service role key only used server-side.
- Documents never deleted (status changes only).
- Bank statements never auto-pushed to QuickBooks.
- Rejection reason min 10 chars.
- One admin (Satish), no admin self-registration.
