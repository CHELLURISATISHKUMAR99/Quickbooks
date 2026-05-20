"use client";

import { useState } from "react";

export function RefreshAccountsButton({ clientId }: { clientId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/quickbooks/accounts`,
        { method: "POST" },
      );
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { synced: number; total: number };
      };
      if (json.success && json.data) {
        setMsg(`Synced ${json.data.synced} (cache: ${json.data.total})`);
        // Refresh the server-rendered count line without a full reload.
        window.location.reload();
      } else {
        setMsg(json.error ?? "Refresh failed");
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void refresh()}
        disabled={busy}
        className="text-xs text-brand hover:underline disabled:opacity-50"
      >
        {busy ? "Refreshing…" : "Refresh accounts"}
      </button>
      {msg && <div className="text-xs text-neutral-500 mt-1">{msg}</div>}
    </div>
  );
}
