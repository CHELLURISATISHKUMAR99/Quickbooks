-- 0003_document_amount_account.sql
-- Adds the bookkeeping fields needed to push meaningful QBO entries
-- (amount + posting account on each approval), the optional clearing
-- account override on the QuickBooks integration, and the per-client
-- cache of the QBO chart of accounts that drives the admin approve UI.

-- ============================================================
-- 1. Document-level approval fields
-- ============================================================
-- Filled in by the admin at approval time. NULLABLE because every
-- existing document predates these columns and we don't backfill;
-- also some categories (bank_statements, tax_documents, other) never
-- sync to QBO and never need an amount.
ALTER TABLE documents
  ADD COLUMN amount                  NUMERIC(14, 2),
  ADD COLUMN posting_account_qb_id   TEXT;

-- Naming: posting_account_qb_id holds whichever QBO account this
-- approval posts to — Expense for receipts/payroll, Income for sales.
-- "Posting" is the accounting-neutral term.

-- NUMERIC(14,2): up to $999,999,999,999.99. Decimal-safe, no float drift.

-- When present, amount must be positive. QBO rejects 0/negative on the
-- entity types we use, and we don't want them in the DB either.
ALTER TABLE documents
  ADD CONSTRAINT documents_amount_positive
    CHECK (amount IS NULL OR amount > 0);

-- ============================================================
-- 2. Optional per-client clearing account override
-- ============================================================
-- JournalEntry-based pushes (sales, payroll) need a counter-account.
-- Default behavior in code: pick the first Bank-type account from the
-- cache. If admin wants to override (e.g. point to a specific Owner
-- Equity or undeposited-funds account), they set this column.
-- Nullable; the admin UI for setting it ships in a later PR.
ALTER TABLE client_integrations
  ADD COLUMN clearing_account_qb_id TEXT;

-- ============================================================
-- 3. Per-client cache of the QBO chart of accounts
-- ============================================================
-- Refreshed on OAuth callback (fire-and-forget) and on manual
-- admin-triggered refresh. Stale rows are fine for the dropdown —
-- worst case the admin picks a deleted/renamed account, QBO rejects,
-- we surface the error and they click Refresh.
CREATE TABLE client_qb_accounts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  qb_account_id            TEXT NOT NULL,
  name                     TEXT NOT NULL,
  account_type             TEXT,
  account_sub_type         TEXT,
  classification           TEXT,
  fully_qualified_name     TEXT,
  active                   BOOLEAN NOT NULL DEFAULT true,
  last_synced_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, qb_account_id)
);

-- Hot path: "give me this client's active Expense accounts" for the
-- approve modal dropdown.
CREATE INDEX client_qb_accounts_client_classification_idx
  ON client_qb_accounts(client_id, classification)
  WHERE active = true;

-- Also index by account_type so we can quickly find the Bank account
-- for the JournalEntry counter-account default.
CREATE INDEX client_qb_accounts_client_type_idx
  ON client_qb_accounts(client_id, account_type)
  WHERE active = true;

-- ============================================================
-- 4. RLS
-- ============================================================
-- Same pattern as other client-scoped tables: clients can read their
-- own (in case we ever expose accounts client-side); admin operations
-- bypass via the service role key.
ALTER TABLE client_qb_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_own_qb_accounts" ON client_qb_accounts
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );
