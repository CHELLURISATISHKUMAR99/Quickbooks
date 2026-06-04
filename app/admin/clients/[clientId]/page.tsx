import {
  countCachedAccounts,
  getClientById,
  getIntegration,
  listDocuments,
  listSyncLogs,
} from "@/lib/supabase/queries";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils/format";
import { RefreshAccountsButton } from "@/components/admin/RefreshAccountsButton";
import { CutoverDateEditor } from "@/components/admin/CutoverDateEditor";
import { tenantHost } from "@/lib/links/app";

export const dynamic = "force-dynamic";

const SYNC_LOG_ICON: Record<string, string> = {
  success: "✓",
  failed: "✗",
  duplicate: "⊘",
  skipped: "↷",
};
const SYNC_LOG_TONE: Record<string, string> = {
  success: "text-green-600",
  failed: "text-red-600",
  duplicate: "text-amber-600",
  skipped: "text-neutral-500",
};

export default async function ClientDetailPage({
  params,
}: {
  params: { clientId: string };
}) {
  const client = await getClientById(params.clientId);
  if (!client) notFound();
  const [qb, plaid, docs, logs, accountsSummary] = await Promise.all([
    getIntegration(client.id, "quickbooks"),
    getIntegration(client.id, "plaid"),
    listDocuments({ clientId: client.id }),
    listSyncLogs(client.id, 20),
    countCachedAccounts(client.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{client.business_name}</h1>
        <p className="text-sm text-neutral-500">
          {client.owner_name} · {client.email}
        </p>
        <p className="text-xs text-neutral-400">
          Portal: {tenantHost(client.slug)}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white border border-neutral-200 rounded-lg p-5">
          <h2 className="font-semibold mb-3">QuickBooks</h2>
          {qb ? (
            <div className="space-y-2">
              <span className="inline-flex items-center gap-2 bg-green-50 text-green-800 border border-green-200 rounded-full px-3 py-1 text-sm">
                Connected · realm {qb.realm_id}
              </span>
              <div className="text-xs text-neutral-500">
                Accounts cached: {accountsSummary.total}
                {accountsSummary.lastSyncedAt &&
                  ` · last synced ${formatDate(accountsSummary.lastSyncedAt)}`}
              </div>
              <RefreshAccountsButton clientId={client.id} />
              <div className="border-t border-neutral-100 pt-3 mt-1">
                <CutoverDateEditor
                  clientId={client.id}
                  initialDate={qb.cutover_date}
                />
                <dl className="mt-2 text-xs text-neutral-500 space-y-0.5">
                  <div>
                    Books closed in QBO through:{" "}
                    {qb.book_close_date
                      ? formatDate(qb.book_close_date)
                      : "—"}
                  </div>
                  <div>
                    Last processed:{" "}
                    {qb.last_processed_at
                      ? formatDate(qb.last_processed_at)
                      : "—"}
                  </div>
                </dl>
              </div>
              <form action={`/api/admin/clients/${client.id}/quickbooks/disconnect`} method="post">
                <button className="text-xs text-red-600 hover:underline" type="submit">
                  Disconnect
                </button>
              </form>
            </div>
          ) : (
            <a
              href={`/api/quickbooks/connect?clientId=${client.id}`}
              className="bg-brand text-white px-4 py-2 rounded-md text-sm font-medium inline-block"
            >
              Connect QuickBooks
            </a>
          )}
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg p-5">
          <h2 className="font-semibold mb-3">Plaid</h2>
          {plaid ? (
            <div className="text-sm">
              <span className="inline-flex items-center gap-2 bg-green-50 text-green-800 border border-green-200 rounded-full px-3 py-1 mb-2">
                Connected{plaid.connected_at && ` on ${formatDate(plaid.connected_at)}`}
              </span>
              <p className="text-xs text-neutral-500">
                Last synced:{" "}
                {plaid.last_synced_at ? formatDate(plaid.last_synced_at) : "—"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              Ask client to connect bank from their Settings page.
            </p>
          )}
        </section>
      </div>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <div className="flex justify-between items-baseline mb-3">
          <h2 className="font-semibold">Document queue</h2>
          <Link
            href={`/admin/queue?clientId=${client.id}`}
            className="text-sm text-brand hover:underline"
          >
            Open queue
          </Link>
        </div>
        <p className="text-sm text-neutral-500">
          {docs.length} total documents on file ·{" "}
          {docs.filter((d) => d.status === "pending_review").length} pending
        </p>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h2 className="font-semibold mb-3">Sync log</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-neutral-500">No sync attempts yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {logs.map((l) => (
              <li
                key={l.id}
                className="flex justify-between border-b border-neutral-100 py-1.5"
              >
                <span>
                  <span className={SYNC_LOG_TONE[l.status] ?? "text-neutral-500"}>
                    {SYNC_LOG_ICON[l.status] ?? "•"}
                  </span>{" "}
                  {l.integration_type}
                  {l.error_message && (
                    <span
                      className={`text-xs ml-2 ${
                        l.status === "failed"
                          ? "text-red-600"
                          : "text-neutral-500"
                      }`}
                    >
                      {l.error_message}
                    </span>
                  )}
                </span>
                <span className="text-xs text-neutral-400">
                  {formatDate(l.attempted_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h2 className="font-semibold mb-3">Danger zone</h2>
        <form action={`/api/admin/clients/${client.id}/deactivate`} method="post">
          <button
            type="submit"
            className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-md"
          >
            {client.is_active ? "Deactivate client" : "Reactivate client"}
          </button>
          <p className="text-xs text-neutral-500 mt-2">
            Deactivating blocks login. All data is retained.
          </p>
        </form>
      </section>
    </div>
  );
}
