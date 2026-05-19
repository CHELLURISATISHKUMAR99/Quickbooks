-- AutoBooks Client Portal - Phase 1 schema
-- All tables have RLS enabled. Admin uses service role to bypass.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CLIENTS
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  email TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- DOCUMENTS
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'receipts', 'sales', 'bank_statements',
    'payroll', 'tax_documents', 'other'
  )),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2030),
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN (
    'pending_review', 'approved', 'rejected', 'sync_failed'
  )),
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  qb_transaction_id TEXT,
  qb_sync_status TEXT DEFAULT 'not_applicable' CHECK (qb_sync_status IN (
    'not_applicable', 'pending', 'success', 'failed'
  ))
);
CREATE INDEX documents_client_status_idx ON documents(client_id, status);
CREATE INDEX documents_status_uploaded_idx ON documents(status, uploaded_at DESC);

-- CLIENT INTEGRATIONS
CREATE TABLE client_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  integration_type TEXT NOT NULL CHECK (integration_type IN ('quickbooks', 'plaid')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  realm_id TEXT,
  plaid_item_id TEXT,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(client_id, integration_type)
);

-- SYNC LOGS
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  integration_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  qb_transaction_id TEXT,
  error_message TEXT,
  attempted_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX sync_logs_client_idx ON sync_logs(client_id, attempted_at DESC);

-- PLAID TRANSACTIONS
CREATE TABLE plaid_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  plaid_transaction_id TEXT UNIQUE NOT NULL,
  account_id TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX plaid_tx_client_date_idx ON plaid_transactions(client_id, date DESC);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  link_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX notifications_client_unread_idx ON notifications(client_id, is_read, created_at DESC);

-- MESSAGES
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'admin')),
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX messages_client_sent_idx ON messages(client_id, sent_at DESC);

-- REPORTS
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  report_type TEXT NOT NULL CHECK (report_type IN ('pnl', 'expense_summary', 'cash_flow')),
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  storage_path TEXT,
  generated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX reports_client_generated_idx ON reports(client_id, generated_at DESC);

-- NOTIFICATION PREFERENCES
CREATE TABLE notification_preferences (
  client_id UUID PRIMARY KEY REFERENCES clients(id),
  approval_emails BOOLEAN DEFAULT true,
  report_emails BOOLEAN DEFAULT true
);

-- ROW LEVEL SECURITY
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_own_row" ON clients
  FOR SELECT USING (clerk_user_id = auth.uid()::text);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_own_documents" ON documents
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE clerk_user_id = auth.uid()::text)
  );

ALTER TABLE client_integrations ENABLE ROW LEVEL SECURITY;
-- no client policy: service role only

ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
-- no client policy: service role only

ALTER TABLE plaid_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_own_transactions" ON plaid_transactions
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE clerk_user_id = auth.uid()::text)
  );

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_own_notifications" ON notifications
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE clerk_user_id = auth.uid()::text)
  );

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_own_messages" ON messages
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE clerk_user_id = auth.uid()::text)
  );

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_own_reports" ON reports
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE clerk_user_id = auth.uid()::text)
  );

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_own_prefs" ON notification_preferences
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE clerk_user_id = auth.uid()::text)
  );
