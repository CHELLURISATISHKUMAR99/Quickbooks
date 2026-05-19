import { getValidAccessToken, qbApiBase } from "./auth";
import type { DocumentCategory, DocumentRow } from "@/types";

const QB_CATEGORIES_NO_SYNC: DocumentCategory[] = [
  "bank_statements",
  "tax_documents",
  "other",
];

export function shouldSync(category: DocumentCategory): boolean {
  return !QB_CATEGORIES_NO_SYNC.includes(category);
}

export interface QbPushResult {
  ok: boolean;
  transactionId?: string;
  error?: string;
}

export async function pushDocumentToQuickBooks(
  doc: DocumentRow,
): Promise<QbPushResult> {
  if (!shouldSync(doc.category)) {
    return { ok: true, transactionId: undefined };
  }
  const { accessToken, realmId } = await getValidAccessToken(doc.client_id);
  const date = `${doc.year}-${String(doc.month).padStart(2, "0")}-01`;
  const memo = `Uploaded via Quad 4 Portal — ${doc.original_filename}`;

  if (doc.category === "receipts") {
    return createPurchase(accessToken, realmId, date, memo);
  }
  if (doc.category === "sales") {
    return createSalesReceipt(accessToken, realmId, date, memo);
  }
  if (doc.category === "payroll") {
    return createJournalEntry(accessToken, realmId, date, memo);
  }
  return { ok: true };
}

async function qbPost(
  accessToken: string,
  realmId: string,
  entity: string,
  body: Record<string, unknown>,
): Promise<QbPushResult> {
  const url = `${qbApiBase()}/v3/company/${realmId}/${entity}?minorversion=70`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: `QB ${entity} failed: ${res.status} ${errText}` };
  }
  const json = (await res.json()) as Record<string, unknown>;
  const created = json[capitalize(entity)] as { Id?: string } | undefined;
  return { ok: true, transactionId: created?.Id };
}

function createPurchase(
  accessToken: string,
  realmId: string,
  date: string,
  memo: string,
): Promise<QbPushResult> {
  return qbPost(accessToken, realmId, "purchase", {
    PaymentType: "Cash",
    AccountRef: { value: "1" },
    TxnDate: date,
    PrivateNote: memo,
    Line: [
      {
        Amount: 0,
        DetailType: "AccountBasedExpenseLineDetail",
        AccountBasedExpenseLineDetail: { AccountRef: { value: "1" } },
        Description: memo,
      },
    ],
  });
}

function createSalesReceipt(
  accessToken: string,
  realmId: string,
  date: string,
  memo: string,
): Promise<QbPushResult> {
  return qbPost(accessToken, realmId, "salesreceipt", {
    TxnDate: date,
    PrivateNote: memo,
    Line: [
      {
        Amount: 0,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: { ItemRef: { value: "1" } },
        Description: memo,
      },
    ],
  });
}

function createJournalEntry(
  accessToken: string,
  realmId: string,
  date: string,
  memo: string,
): Promise<QbPushResult> {
  return qbPost(accessToken, realmId, "journalentry", {
    TxnDate: date,
    PrivateNote: memo,
    Line: [
      {
        Amount: 0,
        DetailType: "JournalEntryLineDetail",
        Description: memo,
        JournalEntryLineDetail: {
          PostingType: "Debit",
          AccountRef: { value: "1" },
        },
      },
      {
        Amount: 0,
        DetailType: "JournalEntryLineDetail",
        Description: memo,
        JournalEntryLineDetail: {
          PostingType: "Credit",
          AccountRef: { value: "1" },
        },
      },
    ],
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
