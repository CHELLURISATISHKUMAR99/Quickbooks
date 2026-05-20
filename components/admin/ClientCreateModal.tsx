"use client";

import { useState } from "react";
import { generateSlug } from "@/lib/utils/slug";
import { tenantHost } from "@/lib/links/app";

export function ClientCreateModal({ onClose }: { onClose: () => void }) {
  const [ownerName, setOwnerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onBusinessChange(v: string) {
    setBusinessName(v);
    if (!slugDirty) setSlug(generateSlug(v));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerName, businessName, email, slug }),
    });
    const json = (await res.json()) as { success: boolean; error?: string };
    setBusy(false);
    if (json.success) {
      onClose();
      window.location.reload();
    } else {
      setError(json.error ?? "Failed");
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-lg mb-4">Add new client</h3>
        <div className="space-y-3 text-sm">
          <Field
            label="Owner name"
            value={ownerName}
            onChange={setOwnerName}
            placeholder="John Smith"
          />
          <Field
            label="Business name"
            value={businessName}
            onChange={onBusinessChange}
            placeholder="Garage King"
          />
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="owner@garageking.com"
            type="email"
          />
          <Field
            label="Portal slug"
            value={slug}
            onChange={(v) => {
              setSlug(v.toLowerCase().replace(/[^a-z0-9]/g, ""));
              setSlugDirty(true);
            }}
            placeholder="garageking"
            help={tenantHost(slug || "<slug>")}
          />
        </div>
        {error && (
          <div className="text-xs text-red-600 mt-2">{error}</div>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border border-neutral-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !ownerName || !businessName || !email || !slug}
            className="px-4 py-1.5 text-sm rounded-md bg-brand text-white disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create client"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  help?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-neutral-300 rounded-md px-3 py-2"
      />
      {help && <div className="text-xs text-neutral-400 mt-1">{help}</div>}
    </div>
  );
}
