"use client";

import { useState } from "react";

// Admin control for a QBO connection's cutover date. Documents dated before
// this are held out-of-scope and never pushed — so onboarding a company
// with existing history doesn't re-post the past.
export function CutoverDateEditor({
  clientId,
  initialDate,
}: {
  clientId: string;
  initialDate: string | null;
}) {
  const [date, setDate] = useState<string>(initialDate ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/quickbooks/cutover`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cutoverDate: date === "" ? null : date }),
        },
      );
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        setMsg("Saved");
      } else {
        setMsg(json.error ?? "Save failed");
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-xs text-neutral-600">
      <label className="block font-medium mb-1">
        Cutover date
        <span className="font-normal text-neutral-400">
          {" "}
          · only documents on/after this push to QuickBooks
        </span>
      </label>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-neutral-300 rounded px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="text-xs text-brand hover:underline disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {date !== "" && (
          <button
            type="button"
            onClick={() => setDate("")}
            disabled={busy}
            className="text-xs text-neutral-400 hover:underline disabled:opacity-50"
          >
            Clear
          </button>
        )}
        {msg && <span className="text-neutral-500">{msg}</span>}
      </div>
    </div>
  );
}
