"use client";

import { useState } from "react";
import Link from "next/link";
import type { Client } from "@/types";
import { formatDate } from "@/lib/utils/format";
import { ClientCreateModal } from "./ClientCreateModal";

export function ClientListClient({ clients }: { clients: Client[] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.business_name.toLowerCase().includes(q) ||
      c.owner_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="flex-1 max-w-sm border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-brand text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Add new client
        </button>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Business</th>
              <th className="px-4 py-2">Owner</th>
              <th className="px-4 py-2">Portal</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-neutral-500"
                >
                  No clients yet
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/admin/clients/${c.id}`}
                    className="hover:underline"
                  >
                    {c.business_name}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.owner_name}</td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {c.slug}.quad4consulting.com
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {formatDate(c.created_at)}
                </td>
                <td className="px-4 py-3">
                  {c.is_active ? (
                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                      Active
                    </span>
                  ) : (
                    <span className="text-xs bg-neutral-100 text-neutral-600 rounded-full px-2 py-0.5">
                      Inactive
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <ClientCreateModal onClose={() => setOpen(false)} />}
    </div>
  );
}
