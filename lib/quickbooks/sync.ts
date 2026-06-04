import { getValidAccessToken, qbApiBase } from "./auth";
import {
  QB_MINOR_VERSION,
  docPostingDate,
  findDuplicatePurchase,
  getBookCloseDate,
  isBeforeCutover,
  isInClosedPeriod,
} from "./guards";
import {
  getClientQbAccount,
  getFirstBankAccount,
  getIntegration,
} from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/utils/format";
import type {
  DocumentCategory,
  DocumentRow,
  QbAccountClassification,
  QbSyncStatus,
} from "@/types";

// ── Category → QBO entity + expected posting-account classification ──
type EntityKind = "purchase" | "journalentry";

// QBO uses PascalCase for entity names in queries and response keys, but
// the REST path is lowercase. Track both explicitly so we don't rely on a
// generic capitalize() that mangles "journalentry" into "Journalentry".
const ENTITY_QBO_NAME: Record<EntityKind, string> = {
  purchase: "Purchase",
  journalentry: "JournalEntry",
};

interface CategoryMapping {
  entity: EntityKind;
  classification: QbAccountClassification;
}

const ENTITY_BY_CATEGORY: Partial<Record<DocumentCategory, CategoryMapping>> = {
  receipts: { entity: "purchase",     classification: "Expense" },
  sales:    { entity: "journalentry", classification: "Revenue" },
  payroll:  { entity: "journalentry", classification: "Expense" },
};

export function shouldSync(category: DocumentCategory): boolean {
  return ENTITY_BY_CATEGORY[category] !== undefined;
}

// Terminal outcome of a push attempt. `ok` stays for back-compat and is
// simply `outcome !== "failed"` — every non-failed outcome is a deliberate,
// recorded decision (the document is approved; it just may not have been
// pushed to QBO, and never silently dropped).
export type PushOutcome =
  | "pushed"
  | "duplicate"
  | "out_of_scope"
  | "closed_period"
  | "failed";

export interface QbPushResult {
  ok: boolean;
  outcome: PushOutcome;
  transactionId?: string;
  deduped?: boolean;
  detail?: string;
  friendlyError?: string;
  rawError?: string;
}

export interface QbPushInput {
  amount: number;
  postingAccountQbId: string;
}

// Single source of truth for how a (non-failed) outcome persists, so the
// approve route and the retry route never diverge.
export interface OutcomePersistence {
  qbSyncStatus: QbSyncStatus;
  syncLogStatus: "success" | "failed" | "skipped" | "duplicate";
}

export function outcomeToPersistence(outcome: PushOutcome): OutcomePersistence {
  switch (outcome) {
    case "pushed":
      return { qbSyncStatus: "success", syncLogStatus: "success" };
    case "duplicate":
      return { qbSyncStatus: "duplicate", syncLogStatus: "duplicate" };
    case "out_of_scope":
      return { qbSyncStatus: "out_of_scope", syncLogStatus: "skipped" };
    case "closed_period":
      return { qbSyncStatus: "closed_period", syncLogStatus: "skipped" };
    case "failed":
      return { qbSyncStatus: "failed", syncLogStatus: "failed" };
  }
}

// ── Friendly error mapping ─────────────────────────────────────────
// Lead with operator-actionable guidance; preserve the raw QBO error
// for admins to expand. Keys are matched against the lower-cased raw
// message in order — first match wins.
const FRIENDLY_ERROR_PATTERNS: { match: RegExp; friendly: string }[] = [
  {
    match: /401/,
    friendly:
      "QuickBooks connection expired. Have the client reconnect from their portal.",
  },
  {
    match: /object not found|object reference|6240/i,
    friendly:
      "Selected account no longer exists in QuickBooks. Click Refresh accounts and pick a different one.",
  },
  {
    match: /invalid account type|account type.*(not allowed|not valid|cannot be used)|cannot be used as/i,
    friendly:
      "This account can't receive this kind of entry. Pick a different account.",
  },
];

function toFriendlyError(raw: string): string {
  for (const { match, friendly } of FRIENDLY_ERROR_PATTERNS) {
    if (match.test(raw)) return friendly;
  }
  return "Couldn't post to QuickBooks. Try a different account or refresh accounts.";
}

// ── Main entrypoint ────────────────────────────────────────────────
export async function pushDocumentToQuickBooks(
  doc: DocumentRow,
  input: QbPushInput,
): Promise<QbPushResult> {
  const mapping = ENTITY_BY_CATEGORY[doc.category];
  if (!mapping) {
    return { ok: true, outcome: "pushed" };
  }

  // Tenant + classification guard. Prevents posting a receipt to a
  // revenue account whether by admin mistake or tampered request.
  const account = await getClientQbAccount(doc.client_id, input.postingAccountQbId);
  if (!account || !account.active) {
    return {
      ok: false,
      outcome: "failed",
      friendlyError:
        "Selected account no longer exists in QuickBooks. Click Refresh accounts and pick a different one.",
      rawError: "posting account not found in cache",
    };
  }
  if (account.classification !== mapping.classification) {
    return {
      ok: false,
      outcome: "failed",
      friendlyError:
        "This account can't receive this kind of entry. Pick a different account.",
      rawError: `expected ${mapping.classification} account, got ${account.classification ?? "unknown"}`,
    };
  }

  let accessToken: string;
  let realmId: string;
  try {
    ({ accessToken, realmId } = await getValidAccessToken(doc.client_id));
  } catch (err) {
    const raw = (err as Error).message;
    return {
      ok: false,
      outcome: "failed",
      friendlyError: toFriendlyError(raw),
      rawError: raw,
    };
  }

  const postingDate = docPostingDate(doc);

  // ── Guard: cutover scope gate (no QBO call) ─────────────────────
  // Onboarding a company with existing history: anything dated before the
  // connection's cutover date is held for catch-up, never pushed forward.
  const integ = await getIntegration(doc.client_id, "quickbooks");
  if (isBeforeCutover(doc, integ?.cutover_date ?? null)) {
    return {
      ok: true,
      outcome: "out_of_scope",
      detail: `Transaction dated ${postingDate} is before the cutover date ${integ?.cutover_date}. Held for catch-up, not pushed.`,
    };
  }

  // ── Guard: closed-period (cached QBO closing date) ──────────────
  const bookClose = await getBookCloseDate({
    accessToken,
    realmId,
    clientId: doc.client_id,
  });
  if (isInClosedPeriod(doc, bookClose)) {
    return {
      ok: true,
      outcome: "closed_period",
      detail: `Period ${postingDate} is on/before the QuickBooks closing date ${bookClose}. Not posted.`,
    };
  }

  // ── Idempotency pre-flight ──────────────────────────────────────
  // QBO query language supports LIKE on string fields. We tag every
  // entity's PrivateNote with `[doc:<lowercased-uuid>]` and look for
  // that needle. Lowercasing both sides keeps the LIKE match stable
  // across QBO instances that may normalize differently.
  const docIdLc = doc.id.toLowerCase();
  const existingId = await findExistingByPrivateNote(
    accessToken,
    realmId,
    mapping.entity,
    docIdLc,
  );
  if (existingId) {
    return {
      ok: true,
      outcome: "duplicate",
      transactionId: existingId,
      deduped: true,
      detail: `Already posted by us as ${ENTITY_QBO_NAME[mapping.entity]} #${existingId}.`,
    };
  }

  // ── Guard: pre-create duplicate check against existing QBO history ──
  // The company may already have this transaction (manual entry, bank
  // feed, prior bookkeeper). For Purchases, look for a match on
  // amount + the document's month before creating a second one.
  if (mapping.entity === "purchase") {
    const dup = await findDuplicatePurchase({
      accessToken,
      realmId,
      amount: input.amount,
      year: doc.year,
      month: doc.month,
    });
    if (dup) {
      return {
        ok: true,
        outcome: "duplicate",
        transactionId: dup.id,
        deduped: true,
        detail: `Matches existing Purchase #${dup.id}${dup.txnDate ? ` dated ${dup.txnDate}` : ""} for ${formatCurrency(input.amount)}. Not re-posted.`,
      };
    }
  }

  // ── Build body ──────────────────────────────────────────────────
  const txnDate = postingDate;
  const privateNote = `[doc:${docIdLc}] ${doc.original_filename}`;

  let body: Record<string, unknown>;
  if (mapping.entity === "purchase") {
    // QBO Purchase requires a payment-source account (Bank / Credit Card /
    // Other Current Liability) at the top level AND an expense category at
    // the line level. They must be different account types — the admin
    // picks the Expense category; the source comes from the same
    // clearing-account resolver JournalEntry uses (override -> first Bank).
    const source = await resolveClearingAccount(doc.client_id);
    if (!source.ok) {
      return {
        ok: false,
        outcome: "failed",
        friendlyError: source.friendlyError,
        rawError: source.rawError,
      };
    }
    body = buildPurchase({
      amount: input.amount,
      expenseAccountQbId: input.postingAccountQbId,
      sourceAccountQbId: source.qbAccountId,
      txnDate,
      privateNote,
    });
  } else {
    // JournalEntry — needs a counter-account.
    const counter = await resolveClearingAccount(doc.client_id);
    if (!counter.ok) {
      return {
        ok: false,
        outcome: "failed",
        friendlyError: counter.friendlyError,
        rawError: counter.rawError,
      };
    }
    body = buildJournalEntry({
      amount: input.amount,
      postingAccountQbId: input.postingAccountQbId,
      counterAccountQbId: counter.qbAccountId,
      isRevenue: mapping.classification === "Revenue",
      txnDate,
      privateNote,
    });
  }

  // ── Create with RequestId for defense-in-depth idempotency ─────
  return qbPost(accessToken, realmId, mapping.entity, body, doc.id);
}

// ── Helpers ─────────────────────────────────────────────────────────

interface ClearingResolution {
  ok: true;
  qbAccountId: string;
  source: "override" | "first_bank";
}
interface ClearingFailure {
  ok: false;
  friendlyError: string;
  rawError: string;
}

async function resolveClearingAccount(
  clientId: string,
): Promise<ClearingResolution | ClearingFailure> {
  const integ = await getIntegration(clientId, "quickbooks");
  if (integ?.clearing_account_qb_id) {
    return {
      ok: true,
      qbAccountId: integ.clearing_account_qb_id,
      source: "override",
    };
  }
  const bank = await getFirstBankAccount(clientId);
  if (bank) {
    return { ok: true, qbAccountId: bank.qb_account_id, source: "first_bank" };
  }
  return {
    ok: false,
    friendlyError:
      "No clearing account available. Create a Bank-type account in QuickBooks first, then refresh accounts.",
    rawError: "no bank account in cache and no clearing_account_qb_id override",
  };
}

interface QbQueryResponse {
  QueryResponse?: Record<string, { Id?: string }[] | undefined>;
}

async function findExistingByPrivateNote(
  accessToken: string,
  realmId: string,
  entity: EntityKind,
  docIdLc: string,
): Promise<string | null> {
  const entityName = ENTITY_QBO_NAME[entity];
  const needle = `[doc:${docIdLc}]`;
  const query = `SELECT Id FROM ${entityName} WHERE PrivateNote LIKE '%${needle}%' MAXRESULTS 1`;
  const url = `${qbApiBase()}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=${QB_MINOR_VERSION}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    // Don't fail the whole push on a dedup query miss — log and continue.
    // Worst case: a duplicate is created, which is what the RequestId
    // header on the subsequent POST is designed to catch as a fallback.
    console.warn(
      `QB dedup query failed (${entity}/${docIdLc}): ${res.status}`,
    );
    return null;
  }
  const json = (await res.json()) as QbQueryResponse;
  const list = json.QueryResponse?.[entityName] ?? [];
  return list[0]?.Id ?? null;
}

async function qbPost(
  accessToken: string,
  realmId: string,
  entity: EntityKind,
  body: Record<string, unknown>,
  requestId: string,
): Promise<QbPushResult> {
  const url = `${qbApiBase()}/v3/company/${realmId}/${entity}?minorversion=${QB_MINOR_VERSION}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      // Idempotency: the document UUID is the RequestId — unique per create
      // operation, stable across retries. Intuit dedupes identical RequestId
      // for the same realm for ~30 days, so an exact retry after a network
      // hiccup returns the original entity instead of creating a duplicate.
      // Belt + suspenders with the PrivateNote pre-flight above.
      RequestId: requestId,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const raw = `QB ${entity} failed: ${res.status} ${await res.text()}`;
    return {
      ok: false,
      outcome: "failed",
      friendlyError: toFriendlyError(raw),
      rawError: raw,
    };
  }
  const json = (await res.json()) as Record<string, unknown>;
  const created = json[ENTITY_QBO_NAME[entity]] as { Id?: string } | undefined;
  return { ok: true, outcome: "pushed", transactionId: created?.Id };
}

interface PurchaseInput {
  amount: number;
  expenseAccountQbId: string;   // line-level: where the expense is booked
  sourceAccountQbId: string;    // top-level: Bank / Credit Card paying for it
  txnDate: string;
  privateNote: string;
}

function buildPurchase(input: PurchaseInput): Record<string, unknown> {
  return {
    PaymentType: "Cash",
    AccountRef: { value: input.sourceAccountQbId },
    TxnDate: input.txnDate,
    PrivateNote: input.privateNote,
    Line: [
      {
        Amount: input.amount,
        DetailType: "AccountBasedExpenseLineDetail",
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: input.expenseAccountQbId },
        },
        Description: input.privateNote,
      },
    ],
  };
}

interface JeInput {
  amount: number;
  postingAccountQbId: string;
  counterAccountQbId: string;
  isRevenue: boolean;
  txnDate: string;
  privateNote: string;
}

function buildJournalEntry(input: JeInput): Record<string, unknown> {
  // For a sale (revenue): debit clearing (asset increases), credit Income.
  // For payroll  (expense): debit Expense, credit clearing (asset decreases).
  const debitAccount = input.isRevenue ? input.counterAccountQbId : input.postingAccountQbId;
  const creditAccount = input.isRevenue ? input.postingAccountQbId : input.counterAccountQbId;
  return {
    TxnDate: input.txnDate,
    PrivateNote: input.privateNote,
    Line: [
      {
        Amount: input.amount,
        DetailType: "JournalEntryLineDetail",
        Description: input.privateNote,
        JournalEntryLineDetail: {
          PostingType: "Debit",
          AccountRef: { value: debitAccount },
        },
      },
      {
        Amount: input.amount,
        DetailType: "JournalEntryLineDetail",
        Description: input.privateNote,
        JournalEntryLineDetail: {
          PostingType: "Credit",
          AccountRef: { value: creditAccount },
        },
      },
    ],
  };
}

// Re-export so external callers can introspect ClearingResolution if
// ever needed (unused for now, kept for testability).
export type { ClearingResolution, ClearingFailure };
