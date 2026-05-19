import {
  listClients,
  listDocuments,
} from "@/lib/supabase/queries";
import {
  DOCUMENT_CATEGORIES,
  monthName,
} from "@/lib/utils/constants";
import { formatBytes, formatDate } from "@/lib/utils/format";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ApproveRejectButtons } from "@/components/admin/ApproveRejectButtons";
import type {
  Client,
  DocumentCategory,
  DocumentRow,
  DocumentStatus,
} from "@/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface SearchParams {
  clientId?: string;
  status?: string;
  category?: string;
  month?: string;
  year?: string;
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const statusFilter = (searchParams.status as DocumentStatus | undefined) ?? "pending_review";
  const category = searchParams.category as DocumentCategory | undefined;
  const month = searchParams.month ? Number(searchParams.month) : undefined;
  const year = searchParams.year ? Number(searchParams.year) : undefined;
  const clientId = searchParams.clientId;

  const [docs, clients] = await Promise.all([
    listDocuments({ clientId, status: statusFilter, category, month, year }),
    listClients(),
  ]);

  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const grouped = new Map<string, DocumentRow[]>();
  for (const d of docs) {
    const list = grouped.get(d.client_id) ?? [];
    list.push(d);
    grouped.set(d.client_id, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Review queue</h1>
        <div className="text-sm text-neutral-500">
          {docs.length} document{docs.length === 1 ? "" : "s"}
        </div>
      </div>

      <form className="flex flex-wrap gap-2 bg-white border border-neutral-200 rounded-lg p-3" method="get">
        <select
          name="clientId"
          defaultValue={clientId ?? ""}
          className="border border-neutral-300 rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.business_name}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={statusFilter}
          className="border border-neutral-300 rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="pending_review">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="sync_failed">Sync failed</option>
        </select>
        <select
          name="category"
          defaultValue={category ?? ""}
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
          name="month"
          defaultValue={month ?? ""}
          className="border border-neutral-300 rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All months</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {monthName(m)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-3 py-1.5 text-sm bg-brand text-white rounded-md"
        >
          Filter
        </button>
      </form>

      {grouped.size === 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg p-10 text-center text-neutral-500">
          No documents match these filters.
        </div>
      )}

      {Array.from(grouped.entries()).map(([cid, list]) => {
        const c = clientMap.get(cid);
        return (
          <section key={cid} className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                {c?.business_name ?? "Unknown client"}
              </h2>
              {c && (
                <Link
                  href={`/admin/clients/${c.id}`}
                  className="text-xs text-brand hover:underline"
                >
                  View client
                </Link>
              )}
            </div>
            <QueueTable list={list} client={c} />
          </section>
        );
      })}
    </div>
  );
}

async function QueueTable({
  list,
  client,
}: {
  list: DocumentRow[];
  client: Client | undefined;
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
          <tr>
            <th className="px-4 py-2">File</th>
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2">Period</th>
            <th className="px-4 py-2">Uploaded</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((d) => (
            <tr key={d.id} className="border-t border-neutral-100 hover:bg-neutral-50">
              <td className="px-4 py-3">
                <a
                  href={`/api/admin/documents/${d.id}/preview`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:underline"
                >
                  {d.original_filename}
                </a>
                <div className="text-xs text-neutral-500">
                  {formatBytes(d.file_size_bytes)} · {d.mime_type}
                </div>
              </td>
              <td className="px-4 py-3 capitalize">
                {d.category.replace("_", " ")}
              </td>
              <td className="px-4 py-3">{monthName(d.month)} {d.year}</td>
              <td className="px-4 py-3">{formatDate(d.uploaded_at)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={d.status} />
                {d.qb_sync_status === "success" && (
                  <div className="text-xs text-green-600 mt-1">Synced ✓</div>
                )}
                {d.qb_sync_status === "failed" && (
                  <div className="text-xs text-red-600 mt-1">Sync failed</div>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {d.status === "pending_review" && (
                  <ApproveRejectButtons documentId={d.id} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
