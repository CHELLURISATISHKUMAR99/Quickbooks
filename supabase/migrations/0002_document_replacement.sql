-- 0002_document_replacement.sql
-- Adds the replacement chain (replaces_id / replaced_by_id) and a
-- single-transaction RPC that inserts the new doc + marks the old
-- one as 'replaced' atomically. Two separate client writes would
-- leave the chain corrupt if the second one failed.

-- Extend status check to include 'replaced'
ALTER TABLE documents
  DROP CONSTRAINT documents_status_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_status_check CHECK (status IN (
    'pending_review', 'approved', 'rejected', 'sync_failed', 'replaced'
  ));

-- Replacement chain
ALTER TABLE documents
  ADD COLUMN replaces_id    UUID REFERENCES documents(id),
  ADD COLUMN replaced_by_id UUID REFERENCES documents(id);

CREATE INDEX documents_replaces_idx
  ON documents(replaces_id)    WHERE replaces_id    IS NOT NULL;
CREATE INDEX documents_replaced_by_idx
  ON documents(replaced_by_id) WHERE replaced_by_id IS NOT NULL;

-- Atomic replace: insert a new document row, then flip the old row
-- to 'replaced' and point its replaced_by_id at the new row. Returns
-- the new document row.
--
-- Caller MUST have already verified that:
--   - p_old_id belongs to p_client_id (tenant guard)
--   - the old row is not already replaced
-- Those checks live in the API route, not in this function, so we
-- can keep the function single-purpose and side-effect-bounded.
CREATE OR REPLACE FUNCTION replace_document(
  p_old_id            UUID,
  p_client_id         UUID,
  p_filename          TEXT,
  p_original_filename TEXT,
  p_storage_path      TEXT,
  p_file_size_bytes   INTEGER,
  p_mime_type         TEXT,
  p_category          TEXT,
  p_month             INTEGER,
  p_year              INTEGER
) RETURNS documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old documents%ROWTYPE;
  v_new documents%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM documents
    WHERE id = p_old_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'old document not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_old.client_id <> p_client_id THEN
    RAISE EXCEPTION 'old document not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_old.status = 'replaced' OR v_old.replaced_by_id IS NOT NULL THEN
    RAISE EXCEPTION 'document already replaced' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO documents (
    client_id, filename, original_filename, storage_path,
    file_size_bytes, mime_type, category, month, year,
    replaces_id
  ) VALUES (
    p_client_id, p_filename, p_original_filename, p_storage_path,
    p_file_size_bytes, p_mime_type, p_category, p_month, p_year,
    p_old_id
  )
  RETURNING * INTO v_new;

  UPDATE documents
    SET status         = 'replaced',
        replaced_by_id = v_new.id,
        reviewed_at    = COALESCE(reviewed_at, now())
    WHERE id = p_old_id;

  RETURN v_new;
END;
$$;
