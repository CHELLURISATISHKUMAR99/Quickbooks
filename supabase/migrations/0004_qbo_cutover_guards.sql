-- 0004_qbo_cutover_guards.sql
-- Safe onboarding / cutover for companies that already have lots of
-- existing transactions in QuickBooks. The push path must never re-post
-- or duplicate history — only go forward from a per-connection cutover
-- date, never post into a closed period, and never create a second
-- entry for something that already exists in QBO.
--
-- This migration adds the state those guards read/write:
--   * cutover_date          — per-connection scope boundary (admin-editable)
--   * book_close_date        — cached QBO closing date (closed-period guard)
--   * book_close_synced_at   — when we last refreshed it (cache visibility)
--   * last_processed_at      — high-water mark so a reconnect resumes
-- plus the new terminal outcomes the document/sync-log status columns
-- need to express: out_of_scope / duplicate / closed_period / skipped.

-- ============================================================
-- 1. Per-connection guard state on the QBO integration
-- ============================================================
ALTER TABLE client_integrations
  ADD COLUMN IF NOT EXISTS cutover_date          DATE,
  ADD COLUMN IF NOT EXISTS book_close_date        DATE,
  ADD COLUMN IF NOT EXISTS book_close_synced_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_processed_at      TIMESTAMPTZ;

-- cutover_date: defaulted in code to the connection date on first connect
-- (so existing history is out of scope) and editable by the admin. NULL
-- means "no cutover configured" → the scope gate is a no-op (preserves
-- pre-migration behavior for any connection that never reconnects).
COMMENT ON COLUMN client_integrations.cutover_date IS
  'Documents whose posting date is before this are held out-of-scope, never pushed. Default = connection date; admin-editable.';
COMMENT ON COLUMN client_integrations.last_processed_at IS
  'High-water mark (document uploaded_at) of the last processed push decision, so a disconnect/reconnect resumes instead of reprocessing.';

-- ============================================================
-- 2. Document QBO sync outcomes
-- ============================================================
-- Extend qb_sync_status to express the new terminal states. A document
-- can be "approved" (the human decision) while its machine outcome is
-- out_of_scope / duplicate / closed_period — i.e. intentionally not
-- pushed, and never silently dropped.
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_qb_sync_status_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_qb_sync_status_check CHECK (qb_sync_status IN (
    'not_applicable',
    'pending',
    'success',
    'failed',
    'out_of_scope',
    'duplicate',
    'closed_period'
  ));

-- ============================================================
-- 3. Sync-log outcomes (audit trail of every push decision)
-- ============================================================
-- 'skipped' covers out_of_scope + closed_period; 'duplicate' records a
-- matched-existing entity. error_message carries the human-readable note
-- for these non-error outcomes.
ALTER TABLE sync_logs
  DROP CONSTRAINT IF EXISTS sync_logs_status_check;

ALTER TABLE sync_logs
  ADD CONSTRAINT sync_logs_status_check CHECK (status IN (
    'success',
    'failed',
    'skipped',
    'duplicate'
  ));
