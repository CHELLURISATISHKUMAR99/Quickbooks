"use client";

import { useState } from "react";

export function ApproveRejectButtons({ documentId }: { documentId: string }) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy("approve");
    setError(null);
    const res = await fetch(`/api/documents/${documentId}/approve`, {
      method: "POST",
    });
    const json = (await res.json()) as { success: boolean; error?: string };
    setBusy(null);
    if (json.success) window.location.reload();
    else setError(json.error ?? "Failed");
  }

  async function reject() {
    if (reason.trim().length < 10) {
      setError("Reason must be at least 10 characters");
      return;
    }
    setBusy("reject");
    setError(null);
    const res = await fetch(`/api/documents/${documentId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const json = (await res.json()) as { success: boolean; error?: string };
    setBusy(null);
    if (json.success) window.location.reload();
    else setError(json.error ?? "Failed");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void approve()}
        disabled={busy !== null}
        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-xs font-medium disabled:opacity-50"
      >
        {busy === "approve" ? "…" : "Approve"}
      </button>
      <button
        type="button"
        onClick={() => setRejectOpen(true)}
        disabled={busy !== null}
        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-xs font-medium disabled:opacity-50"
      >
        Reject
      </button>

      {rejectOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setRejectOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-5 max-w-md w-full mx-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-2">Reject document</h3>
            <p className="text-xs text-neutral-500 mb-3">
              Reason will be emailed to the client. Minimum 10 characters.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Receipt image too blurry — please re-upload"
              className="w-full border border-neutral-300 rounded-md p-2 text-sm"
            />
            {error && (
              <div className="text-xs text-red-600 mt-1">{error}</div>
            )}
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setRejectOpen(false)}
                className="px-3 py-1.5 text-sm rounded-md border border-neutral-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void reject()}
                disabled={busy !== null}
                className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white disabled:opacity-50"
              >
                {busy === "reject" ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
