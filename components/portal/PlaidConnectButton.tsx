"use client";

import { useState } from "react";

declare global {
  interface Window {
    Plaid?: {
      create: (config: {
        token: string;
        onSuccess: (publicToken: string) => void;
        onExit?: () => void;
      }) => { open: () => void };
    };
  }
}

export function PlaidConnectButton({ connected }: { connected: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadScript(): Promise<void> {
    if (window.Plaid) return;
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load Plaid"));
      document.body.appendChild(s);
    });
  }

  async function connect() {
    setLoading(true);
    setError(null);
    try {
      await loadScript();
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const json = (await res.json()) as {
        success: boolean;
        data?: { linkToken: string };
        error?: string;
      };
      if (!json.success || !json.data) {
        throw new Error(json.error ?? "Failed to create link token");
      }
      const handler = window.Plaid?.create({
        token: json.data.linkToken,
        onSuccess: async (publicToken) => {
          const exch = await fetch("/api/plaid/exchange-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicToken }),
          });
          const ej = (await exch.json()) as { success: boolean };
          if (ej.success) window.location.reload();
        },
      });
      handler?.open();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void connect()}
        disabled={loading}
        className="bg-brand text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
      >
        {connected ? "Reconnect bank" : loading ? "Loading…" : "Connect your bank"}
      </button>
      {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
    </div>
  );
}
