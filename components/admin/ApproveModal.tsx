"use client";

import { useCallback, useEffect, useState } from "react";
import { DOCUMENT_CATEGORIES } from "@/lib/utils/constants";
import { formatDate } from "@/lib/utils/format";
import type { DocumentCategory, QbAccountClassification } from "@/types";

interface AccountOption {
  qbAccountId: string;
  name: string;
  fullyQualifiedName: string | null;
  accountType: string | null;
  classification: QbAccountClassification | null;
}

interface AccountsResponse {
  accounts: AccountOption[];
  total: number;
  lastSyncedAt: string | null;
}

const CLASSIFICATION_BY_CATEGORY: Partial<Record<DocumentCategory, QbAccountClassification>> = {
  receipts: "Expense",
  sales: "Revenue",
  payroll: "Expense",
};

const ENTITY_LABEL: Partial<Record<DocumentCategory, string>> = {
  receipts: "Purchase",
  sales: "Journal Entry",
  payroll: "Journal Entry",
};

export function ApproveModal({
  doc,
  clientId,
  clientName,
  onClose,
}: {
  doc: {
    id: string;
    original_filename: string;
    category: DocumentCategory;
    month: number;
    year: number;
  };
  clientId: string;
  clientName: string;
  onClose: () => void;
}) {
  const classification = CLASSIFICATION_BY_CATEGORY[doc.category];
  const categoryLabel =
    DOCUMENT_CATEGORIES.find((c) => c.value === doc.category)?.label ??
    doc.category;

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const loadAccounts = useCallback(async () => {
    if (!classification) return;
    setAccountsLoading(true);
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/quickbooks/accounts?classification=${classification}`,
      );
      const json = (await res.json()) as {
        success: boolean;
        data?: AccountsResponse;
        error?: string;
      };
      if (json.success && json.data) {
        setAccounts(json.data.accounts);
        setLastSyncedAt(json.data.lastSyncedAt);
      }
    } finally {
      setAccountsLoading(false);
    }
  }, [classification, clientId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  // ESC closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/quickbooks/accounts`,
        { method: "POST" },
      );
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { lastSyncedAt: string | null };
      };
      if (!json.success) {
        setError(json.error ?? "Refresh failed");
        return;
      }
      await loadAccounts();
    } finally {
      setRefreshing(false);
    }
  }

  async function submit() {
    const amt = Number(amount);
    if (!isFinite(amt) || amt <= 0) {
      setError("Enter a positive amount");
      return;
    }
    if (!accountId) {
      setError("Pick an account");
      return;
    }
    setSubmitting(true);
    setError(null);
    setRawError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, postingAccountQbId: accountId }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { transactionId?: string; deduped?: boolean };
      };
      if (json.success) {
        onClose();
        window.location.reload();
        return;
      }
      setError(json.error ?? "Approve failed");
      // Server returns the friendly message in `error`; if the response
      // carries any extra raw text in the future we'd surface it here.
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const amtNum = Number(amount);
  const formValid =
    isFinite(amtNum) && amtNum > 0 && accountId.length > 0 && !accountsLoading;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="bg-white rounded-lg p-5 max-w-md w-full mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-modal-title"
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-lg" id="approve-modal-title">
              Approve {categoryLabel.toLowerCase()}
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5 break-all">
              {doc.original_filename}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {clientName} · {doc.month}/{doc.year}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-neutral-400 hover:text-neutral-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div
            className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md p-3 mb-3"
            role="alert"
          >
            <div>{error}</div>
            {rawError && (
              <div className="mt-1">
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() => setShowRaw((s) => !s)}
                >
                  {showRaw ? "Hide details" : "Show details"}
                </button>
                {showRaw && (
                  <pre className="text-[11px] font-mono mt-1 whitespace-pre-wrap break-all">
                    {rawError}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        <label className="block text-sm font-medium mb-1">
          Amount <span className="text-red-600">*</span>
        </label>
        <div className="relative mb-3">
          <span className="absolute left-3 top-2 text-neutral-500 text-sm">
            $
          </span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={submitting}
            placeholder="0.00"
            className="w-full border border-neutral-300 rounded-md pl-6 pr-3 py-2 text-sm"
            aria-required="true"
          />
        </div>

        <label className="block text-sm font-medium mb-1">
          {classification === "Revenue" ? "Income account" : "Expense account"}{" "}
          <span className="text-red-600">*</span>
        </label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          disabled={accountsLoading || refreshing || submitting || accounts.length === 0}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          aria-required="true"
        >
          <option value="">
            {accountsLoading
              ? "Loading…"
              : accounts.length === 0
                ? "No accounts cached"
                : "— Select —"}
          </option>
          {accounts.map((a) => (
            <option key={a.qbAccountId} value={a.qbAccountId}>
              {a.fullyQualifiedName ?? a.name}
            </option>
          ))}
        </select>
        <div className="flex items-center justify-between mt-1.5 text-xs text-neutral-500">
          <span>
            {accounts.length} {classification?.toLowerCase()} account
            {accounts.length === 1 ? "" : "s"}
            {lastSyncedAt && ` · last synced ${formatDate(lastSyncedAt)}`}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing || submitting}
            className="text-brand hover:underline disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh accounts"}
          </button>
        </div>

        <p className="text-xs text-neutral-500 mt-4">
          This will create a {ENTITY_LABEL[doc.category]} in QuickBooks
          {process.env.NEXT_PUBLIC_QB_ENVIRONMENT === "sandbox" ? " (sandbox)" : ""}.
        </p>

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 text-sm rounded-md border border-neutral-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!formValid || submitting}
            className="px-4 py-1.5 text-sm rounded-md bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50"
          >
            {submitting ? "Approving…" : "Approve and push"}
          </button>
        </div>
      </div>
    </div>
  );
}
