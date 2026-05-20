import { getServiceSupabase, DOCUMENTS_BUCKET } from "./server";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/utils/constants";
import type {
  Client,
  ClientIntegration,
  ClientQbAccount,
  DocumentRow,
  DocumentCategory,
  DocumentStatus,
  IntegrationType,
  MessageRow,
  NotificationRow,
  PlaidTransaction,
  QbAccountClassification,
  ReportRow,
  SyncLog,
} from "@/types";

// ============ CLIENTS ============

export async function listClients(): Promise<Client[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Client[];
}

export async function getClientById(id: string): Promise<Client | null> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Client) ?? null;
}

export async function getClientBySlug(slug: string): Promise<Client | null> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("clients")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Client) ?? null;
}

export async function getClientByClerkId(
  clerkUserId: string,
): Promise<Client | null> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("clients")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (error) throw error;
  return (data as Client) ?? null;
}

export async function slugExists(slug: string): Promise<boolean> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("clients")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function createClient(input: {
  clerkUserId: string;
  businessName: string;
  ownerName: string;
  email: string;
  slug: string;
}): Promise<Client> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("clients")
    .insert({
      clerk_user_id: input.clerkUserId,
      business_name: input.businessName,
      owner_name: input.ownerName,
      email: input.email,
      slug: input.slug,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Client;
}

export async function setClientActive(
  clientId: string,
  isActive: boolean,
): Promise<void> {
  const sb = getServiceSupabase();
  const { error } = await sb
    .from("clients")
    .update({ is_active: isActive })
    .eq("id", clientId);
  if (error) throw error;
}

// ============ DOCUMENTS ============

export interface DocumentFilter {
  clientId?: string;
  status?: DocumentStatus;
  category?: DocumentCategory;
  month?: number;
  year?: number;
  includeReplaced?: boolean;
}

export async function listDocuments(
  filter: DocumentFilter = {},
): Promise<DocumentRow[]> {
  const sb = getServiceSupabase();
  let q = sb
    .from("documents")
    .select("*")
    .order("uploaded_at", { ascending: false });
  if (filter.clientId) q = q.eq("client_id", filter.clientId);
  if (filter.status) q = q.eq("status", filter.status);
  else if (!filter.includeReplaced) q = q.neq("status", "replaced");
  if (filter.category) q = q.eq("category", filter.category);
  if (filter.month) q = q.eq("month", filter.month);
  if (filter.year) q = q.eq("year", filter.year);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DocumentRow[];
}

export async function getDocumentById(
  id: string,
): Promise<DocumentRow | null> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as DocumentRow) ?? null;
}

export async function insertDocument(input: {
  clientId: string;
  filename: string;
  originalFilename: string;
  storagePath: string;
  fileSizeBytes: number;
  mimeType: string;
  category: DocumentCategory;
  month: number;
  year: number;
}): Promise<DocumentRow> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("documents")
    .insert({
      client_id: input.clientId,
      filename: input.filename,
      original_filename: input.originalFilename,
      storage_path: input.storagePath,
      file_size_bytes: input.fileSizeBytes,
      mime_type: input.mimeType,
      category: input.category,
      month: input.month,
      year: input.year,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as DocumentRow;
}

export async function setDocumentApprovalFields(input: {
  documentId: string;
  amount: number;
  postingAccountQbId: string;
}): Promise<void> {
  const sb = getServiceSupabase();
  const { error } = await sb
    .from("documents")
    .update({
      amount: input.amount,
      posting_account_qb_id: input.postingAccountQbId,
    })
    .eq("id", input.documentId);
  if (error) throw error;
}

export async function updateDocumentStatus(input: {
  documentId: string;
  status: DocumentStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  qbTransactionId?: string;
  qbSyncStatus?: "pending" | "success" | "failed" | "not_applicable";
}): Promise<void> {
  const sb = getServiceSupabase();
  const patch: Record<string, unknown> = {
    status: input.status,
    reviewed_at: new Date().toISOString(),
  };
  if (input.rejectionReason !== undefined)
    patch.rejection_reason = input.rejectionReason;
  if (input.reviewedBy !== undefined) patch.reviewed_by = input.reviewedBy;
  if (input.qbTransactionId !== undefined)
    patch.qb_transaction_id = input.qbTransactionId;
  if (input.qbSyncStatus !== undefined) patch.qb_sync_status = input.qbSyncStatus;
  const { error } = await sb
    .from("documents")
    .update(patch)
    .eq("id", input.documentId);
  if (error) throw error;
}

export async function countUploadsLastHour(clientId: string): Promise<number> {
  const sb = getServiceSupabase();
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count, error } = await sb
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("uploaded_at", since);
  if (error) throw error;
  return count ?? 0;
}

export async function getSignedDocumentUrl(
  storagePath: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const sb = getServiceSupabase();
  const { data, error } = await sb.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);
  if (error) throw error;
  return data.signedUrl;
}

// TODO: this is one storage list() per call. Fine for the detail-page
// case (one doc at a time). If we ever do bulk views or hover-previews,
// switch to a HEAD-style existence check or cache results — otherwise
// it becomes N+1 against Supabase Storage.
export async function documentFileExists(
  storagePath: string,
): Promise<boolean> {
  const sb = getServiceSupabase();
  const slash = storagePath.lastIndexOf("/");
  const dir = slash >= 0 ? storagePath.slice(0, slash) : "";
  const name = slash >= 0 ? storagePath.slice(slash + 1) : storagePath;
  const { data, error } = await sb.storage
    .from(DOCUMENTS_BUCKET)
    .list(dir, { search: name, limit: 1 });
  if (error) return false;
  return (data ?? []).some((f) => f.name === name);
}

export async function replaceDocumentRpc(input: {
  oldDocumentId: string;
  clientId: string;
  filename: string;
  originalFilename: string;
  storagePath: string;
  fileSizeBytes: number;
  mimeType: string;
  category: DocumentCategory;
  month: number;
  year: number;
}): Promise<DocumentRow> {
  const sb = getServiceSupabase();
  const { data, error } = await sb.rpc("replace_document", {
    p_old_id: input.oldDocumentId,
    p_client_id: input.clientId,
    p_filename: input.filename,
    p_original_filename: input.originalFilename,
    p_storage_path: input.storagePath,
    p_file_size_bytes: input.fileSizeBytes,
    p_mime_type: input.mimeType,
    p_category: input.category,
    p_month: input.month,
    p_year: input.year,
  });
  if (error) throw error;
  return data as DocumentRow;
}

// ============ INTEGRATIONS ============

export async function getIntegration(
  clientId: string,
  type: IntegrationType,
): Promise<ClientIntegration | null> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("client_integrations")
    .select("*")
    .eq("client_id", clientId)
    .eq("integration_type", type)
    .maybeSingle();
  if (error) throw error;
  return (data as ClientIntegration) ?? null;
}

export async function upsertIntegration(input: {
  clientId: string;
  type: IntegrationType;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  realmId?: string | null;
  plaidItemId?: string | null;
}): Promise<void> {
  const sb = getServiceSupabase();
  const { error } = await sb.from("client_integrations").upsert(
    {
      client_id: input.clientId,
      integration_type: input.type,
      access_token: input.accessToken,
      refresh_token: input.refreshToken ?? null,
      token_expires_at: input.tokenExpiresAt ?? null,
      realm_id: input.realmId ?? null,
      plaid_item_id: input.plaidItemId ?? null,
      is_active: true,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "client_id,integration_type" },
  );
  if (error) throw error;
}

export async function markIntegrationSynced(
  clientId: string,
  type: IntegrationType,
): Promise<void> {
  const sb = getServiceSupabase();
  const { error } = await sb
    .from("client_integrations")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("integration_type", type);
  if (error) throw error;
}

// ============ SYNC LOGS ============

export async function insertSyncLog(input: {
  documentId?: string;
  clientId: string;
  integrationType: string;
  status: "success" | "failed";
  qbTransactionId?: string;
  errorMessage?: string;
}): Promise<void> {
  const sb = getServiceSupabase();
  const { error } = await sb.from("sync_logs").insert({
    document_id: input.documentId ?? null,
    client_id: input.clientId,
    integration_type: input.integrationType,
    status: input.status,
    qb_transaction_id: input.qbTransactionId ?? null,
    error_message: input.errorMessage ?? null,
  });
  if (error) throw error;
}

export async function listSyncLogs(
  clientId?: string,
  limit = 100,
): Promise<SyncLog[]> {
  const sb = getServiceSupabase();
  let q = sb
    .from("sync_logs")
    .select("*")
    .order("attempted_at", { ascending: false })
    .limit(limit);
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SyncLog[];
}

// ============ PLAID TRANSACTIONS ============

export async function insertPlaidTransactions(
  rows: Omit<PlaidTransaction, "id" | "synced_at">[],
): Promise<void> {
  if (rows.length === 0) return;
  const sb = getServiceSupabase();
  const { error } = await sb.from("plaid_transactions").upsert(
    rows.map((r) => ({
      client_id: r.client_id,
      plaid_transaction_id: r.plaid_transaction_id,
      account_id: r.account_id,
      date: r.date,
      description: r.description,
      amount: r.amount,
      category: r.category,
    })),
    { onConflict: "plaid_transaction_id" },
  );
  if (error) throw error;
}

export async function listPlaidTransactions(
  clientId: string,
  limit = 30,
): Promise<PlaidTransaction[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("plaid_transactions")
    .select("*")
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PlaidTransaction[];
}

// ============ NOTIFICATIONS ============

export async function insertNotification(input: {
  clientId: string | null;
  type: string;
  title: string;
  message: string;
  linkUrl?: string;
}): Promise<void> {
  const sb = getServiceSupabase();
  const { error } = await sb.from("notifications").insert({
    client_id: input.clientId,
    type: input.type,
    title: input.title,
    message: input.message,
    link_url: input.linkUrl ?? null,
  });
  if (error) throw error;
}

export async function listNotifications(
  clientId: string,
  limit = 20,
): Promise<NotificationRow[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("notifications")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const sb = getServiceSupabase();
  const { error } = await sb
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);
  if (error) throw error;
}

// ============ MESSAGES ============

export async function listMessages(clientId: string): Promise<MessageRow[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("messages")
    .select("*")
    .eq("client_id", clientId)
    .order("sent_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export async function insertMessage(input: {
  clientId: string;
  senderRole: "client" | "admin";
  body: string;
}): Promise<MessageRow> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("messages")
    .insert({
      client_id: input.clientId,
      sender_role: input.senderRole,
      body: input.body,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MessageRow;
}

// ============ REPORTS ============

export async function listReports(clientId: string): Promise<ReportRow[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("reports")
    .select("*")
    .eq("client_id", clientId)
    .order("generated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReportRow[];
}

export async function insertReport(input: {
  clientId: string;
  reportType: "pnl" | "expense_summary" | "cash_flow";
  dateRangeStart: string;
  dateRangeEnd: string;
  storagePath?: string;
}): Promise<ReportRow> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("reports")
    .insert({
      client_id: input.clientId,
      report_type: input.reportType,
      date_range_start: input.dateRangeStart,
      date_range_end: input.dateRangeEnd,
      storage_path: input.storagePath ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ReportRow;
}

// ============ ADMIN DASHBOARD ============

export interface AdminSummary {
  pendingTotal: number;
  approvedToday: number;
  rejectedToday: number;
  syncFailed: number;
  clientsNoUploadsThisMonth: number;
}

export async function getAdminSummary(): Promise<AdminSummary> {
  const sb = getServiceSupabase();
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);

  const [pending, approved, rejected, failed, clients] = await Promise.all([
    sb
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
    sb
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .gte("reviewed_at", startToday.toISOString()),
    sb
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "rejected")
      .gte("reviewed_at", startToday.toISOString()),
    sb
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("qb_sync_status", "failed"),
    sb.from("clients").select("id").eq("is_active", true),
  ]);

  const activeIds = ((clients.data ?? []) as { id: string }[]).map(
    (c) => c.id,
  );
  let noUploads = 0;
  if (activeIds.length > 0) {
    const { data: uploaders } = await sb
      .from("documents")
      .select("client_id")
      .gte("uploaded_at", startMonth.toISOString());
    const set = new Set(
      ((uploaders ?? []) as { client_id: string }[]).map((u) => u.client_id),
    );
    noUploads = activeIds.filter((id) => !set.has(id)).length;
  }

  return {
    pendingTotal: pending.count ?? 0,
    approvedToday: approved.count ?? 0,
    rejectedToday: rejected.count ?? 0,
    syncFailed: failed.count ?? 0,
    clientsNoUploadsThisMonth: noUploads,
  };
}

// ============ QBO ACCOUNTS CACHE ============

export interface UpsertQbAccountInput {
  qbAccountId: string;
  name: string;
  accountType: string | null;
  accountSubType: string | null;
  classification: QbAccountClassification | null;
  fullyQualifiedName: string | null;
  active: boolean;
}

export async function upsertClientQbAccounts(
  clientId: string,
  rows: UpsertQbAccountInput[],
): Promise<void> {
  if (rows.length === 0) return;
  const sb = getServiceSupabase();
  const payload = rows.map((r) => ({
    client_id: clientId,
    qb_account_id: r.qbAccountId,
    name: r.name,
    account_type: r.accountType,
    account_sub_type: r.accountSubType,
    classification: r.classification,
    fully_qualified_name: r.fullyQualifiedName,
    active: r.active,
    last_synced_at: new Date().toISOString(),
  }));
  const { error } = await sb
    .from("client_qb_accounts")
    .upsert(payload, { onConflict: "client_id,qb_account_id" });
  if (error) throw error;
}

export async function listClientQbAccounts(
  clientId: string,
  filter?: { classification?: QbAccountClassification; activeOnly?: boolean },
): Promise<ClientQbAccount[]> {
  const sb = getServiceSupabase();
  let q = sb
    .from("client_qb_accounts")
    .select("*")
    .eq("client_id", clientId)
    .order("fully_qualified_name", { ascending: true });
  if (filter?.classification) q = q.eq("classification", filter.classification);
  if (filter?.activeOnly !== false) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ClientQbAccount[];
}

export async function getFirstBankAccount(
  clientId: string,
): Promise<ClientQbAccount | null> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("client_qb_accounts")
    .select("*")
    .eq("client_id", clientId)
    .eq("account_type", "Bank")
    .eq("active", true)
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ClientQbAccount) ?? null;
}

export async function getClientQbAccount(
  clientId: string,
  qbAccountId: string,
): Promise<ClientQbAccount | null> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("client_qb_accounts")
    .select("*")
    .eq("client_id", clientId)
    .eq("qb_account_id", qbAccountId)
    .maybeSingle();
  if (error) throw error;
  return (data as ClientQbAccount) ?? null;
}

export async function countCachedAccounts(clientId: string): Promise<{
  total: number;
  lastSyncedAt: string | null;
}> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("client_qb_accounts")
    .select("last_synced_at")
    .eq("client_id", clientId)
    .order("last_synced_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const { count, error: cErr } = await sb
    .from("client_qb_accounts")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);
  if (cErr) throw cErr;
  return {
    total: count ?? 0,
    lastSyncedAt: data?.[0]?.last_synced_at ?? null,
  };
}
