"use client";

import { useMemo, useState } from "react";
import {
  DOCUMENT_CATEGORIES,
  monthName,
} from "@/lib/utils/constants";
import type {
  DocumentCategory,
  DocumentRow,
  DocumentStatus,
} from "@/types";
import { formatBytes, formatDate } from "@/lib/utils/format";
import { StatusBadge } from "@/components/shared/StatusBadge";

export function DocumentList({ docs }: { docs: DocumentRow[] }) {
  const [category, setCategory] = useState<DocumentCategory | "">("");
  const [status, setStatus] = useState<DocumentStatus | "">("");
  const [month, setMonth] = useState<number | "">("");

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (category && d.category !== category) return false;
      if (status && d.status !== status) return false;
      if (month && d.month !== month) return false;
      return true;
    });
  }, [docs, category, status, month]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(e) =>
            setCategory((e.target.value as DocumentCategory | "") || "")
          }
          className="border border-neutral-300 rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All categories</option>
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) =>
            setStatus((e.target.value as DocumentStatus | "") || "")
          }
          className="border border-neutral-300 rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All statuses</option>
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="sync_failed">Sync failed</option>
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value) || "")}
          className="border border-neutral-300 rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All months</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {monthName(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">File</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2">Uploaded</th>
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
                  No documents match your filters
                </td>
              </tr>
            )}
            {filtered.map((d) => (
              <tr key={d.id} className="border-t border-neutral-100">
                <td className="px-4 py-3">
                  <div className="font-medium">{d.original_filename}</div>
                  <div className="text-xs text-neutral-500">
                    {formatBytes(d.file_size_bytes)}
                  </div>
                </td>
                <td className="px-4 py-3 capitalize">
                  {d.category.replace("_", " ")}
                </td>
                <td className="px-4 py-3">
                  {monthName(d.month)} {d.year}
                </td>
                <td className="px-4 py-3">{formatDate(d.uploaded_at)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={d.status} />
                  {d.status === "rejected" && d.rejection_reason && (
                    <div
                      className="text-xs text-red-600 mt-1"
                      title={d.rejection_reason}
                    >
                      {d.rejection_reason}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
