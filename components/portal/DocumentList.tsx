"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { portalHref } from "@/lib/links/portal";

const CATEGORY_SET = new Set(DOCUMENT_CATEGORIES.map((c) => c.value));
const STATUS_SET = new Set<DocumentStatus>([
  "pending_review",
  "approved",
  "rejected",
  "sync_failed",
  "replaced",
]);

export function DocumentList({
  slug,
  docs,
}: {
  slug: string;
  docs: DocumentRow[];
}) {
  const search = useSearchParams();
  const seedCategory = search?.get("category");
  const seedStatus = search?.get("status");
  const seedMonth = Number(search?.get("month"));

  const [category, setCategory] = useState<DocumentCategory | "">(
    seedCategory && CATEGORY_SET.has(seedCategory as DocumentCategory)
      ? (seedCategory as DocumentCategory)
      : "",
  );
  const [status, setStatus] = useState<DocumentStatus | "">(
    seedStatus && STATUS_SET.has(seedStatus as DocumentStatus)
      ? (seedStatus as DocumentStatus)
      : "",
  );
  const [month, setMonth] = useState<number | "">(
    seedMonth >= 1 && seedMonth <= 12 ? seedMonth : "",
  );

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (category && d.category !== category) return false;
      if (status && d.status !== status) return false;
      if (month && d.month !== month) return false;
      return true;
    });
  }, [docs, category, status, month]);

  // The `from` param round-trips the current filter state back to /documents
  // via the doc-detail back link. Store as a portal-prefixed path so the
  // back link works on every host.
  const fromParam = useMemo(() => {
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    if (status) qs.set("status", status);
    if (month) qs.set("month", String(month));
    const tail = qs.toString();
    return portalHref(slug, `/documents${tail ? `?${tail}` : ""}`);
  }, [slug, category, status, month]);

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
            {filtered.map((d) => {
              const href = portalHref(
                slug,
                `/documents/${d.id}?from=${encodeURIComponent(fromParam)}`,
              );
              return (
                <tr
                  key={d.id}
                  className="border-t border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <Link href={href} className="block">
                      <div className="font-medium text-neutral-900">
                        {d.original_filename}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {formatBytes(d.file_size_bytes)}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 capitalize">
                    <Link href={href} className="block">
                      {d.category.replace("_", " ")}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={href} className="block">
                      {monthName(d.month)} {d.year}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={href} className="block">
                      {formatDate(d.uploaded_at)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={href} className="block">
                      <StatusBadge status={d.status} />
                      {d.status === "rejected" && d.rejection_reason && (
                        <div
                          className="text-xs text-red-600 mt-1"
                          title={d.rejection_reason}
                        >
                          {d.rejection_reason}
                        </div>
                      )}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
