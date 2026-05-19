export type DocumentCategory =
  | "receipts"
  | "sales"
  | "bank_statements"
  | "payroll"
  | "tax_documents"
  | "other";

export type DocumentStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "sync_failed";

export type QbSyncStatus = "not_applicable" | "pending" | "success" | "failed";

export type IntegrationType = "quickbooks" | "plaid";

export type ReportType = "pnl" | "expense_summary" | "cash_flow";

export type SenderRole = "client" | "admin";

export interface Client {
  id: string;
  clerk_user_id: string;
  business_name: string;
  owner_name: string;
  email: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  client_id: string;
  filename: string;
  original_filename: string;
  storage_path: string;
  file_size_bytes: number;
  mime_type: string;
  category: DocumentCategory;
  month: number;
  year: number;
  status: DocumentStatus;
  rejection_reason: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  qb_transaction_id: string | null;
  qb_sync_status: QbSyncStatus;
}

export interface ClientIntegration {
  id: string;
  client_id: string;
  integration_type: IntegrationType;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  realm_id: string | null;
  plaid_item_id: string | null;
  connected_at: string;
  last_synced_at: string | null;
  is_active: boolean;
}

export interface SyncLog {
  id: string;
  document_id: string | null;
  client_id: string;
  integration_type: string;
  status: "success" | "failed";
  qb_transaction_id: string | null;
  error_message: string | null;
  attempted_at: string;
}

export interface PlaidTransaction {
  id: string;
  client_id: string;
  plaid_transaction_id: string;
  account_id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  synced_at: string;
}

export interface NotificationRow {
  id: string;
  client_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link_url: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  client_id: string;
  sender_role: SenderRole;
  body: string;
  is_read: boolean;
  sent_at: string;
}

export interface ReportRow {
  id: string;
  client_id: string;
  report_type: ReportType;
  date_range_start: string;
  date_range_end: string;
  storage_path: string | null;
  generated_at: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ClerkPublicMetadata {
  role?: "client" | "admin";
  clientId?: string;
}
