import Link from "next/link";
import { getClientBySlug, listDocuments, listPlaidTransactions, getIntegration } from "@/lib/supabase/queries";
import { fetchDashboardMetrics, type DashboardMetrics } from "@/lib/quickbooks/reports";
import { getAccountBalances } from "@/lib/plaid/sync";
import { DashboardMetrics as MetricsView } from "@/components/portal/DashboardMetrics";
import { RevenueChart } from "@/components/portal/RevenueChart";
import { ActivityFeed, type ActivityEvent } from "@/components/portal/ActivityFeed";
import { formatCurrency, formatDate, timeAgo } from "@/lib/utils/format";
import { notFound } from "next/navigation";
import type { DocumentRow } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: { slug: string };
}) {
  const client = await getClientBySlug(params.slug);
  if (!client) notFound();

  const [docs, qbIntegration, plaidIntegration] = await Promise.all([
    listDocuments({ clientId: client.id }),
    getIntegration(client.id, "quickbooks"),
    getIntegration(client.id, "plaid"),
  ]);

  let metrics: DashboardMetrics | null = null;
  if (qbIntegration) {
    try {
      metrics = await fetchDashboardMetrics(client.id);
    } catch {
      metrics = null;
    }
  }

  let balances: Awaited<ReturnType<typeof getAccountBalances>> = [];
  let transactions: Awaited<ReturnType<typeof listPlaidTransactions>> = [];
  if (plaidIntegration) {
    try {
      balances = await getAccountBalances(client.id);
    } catch {
      balances = [];
    }
    transactions = await listPlaidTransactions(client.id, 10);
  }

  const events: ActivityEvent[] = docs.slice(0, 10).map((d) => ({
    id: d.id,
    type:
      d.status === "approved"
        ? "approved"
        : d.status === "rejected"
          ? "rejected"
          : "uploaded",
    description: descriptionFor(d),
    at: d.reviewed_at ?? d.uploaded_at,
    href: `/documents/${d.id}`,
  }));

  const rejected = docs.filter((d) => d.status === "rejected").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-neutral-500">
          {metrics
            ? `Last updated ${timeAgo(metrics.asOf)}`
            : "Connect QuickBooks to see financials"}
        </p>
      </div>

      {rejected > 0 && (
        <Link
          href="/documents?status=rejected"
          className="block bg-red-50 border border-red-200 text-red-800 rounded-md px-4 py-3 text-sm hover:bg-red-100"
        >
          You have {rejected} rejected document{rejected === 1 ? "" : "s"} — review and re-upload →
        </Link>
      )}
      {!plaidIntegration && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-4 py-3 text-sm">
          Connect your bank account from Settings to see balances and transactions.
        </div>
      )}

      {metrics ? (
        <>
          <MetricsView
            revenueMtd={metrics.revenueMtd}
            expensesMtd={metrics.expensesMtd}
            netProfitMtd={metrics.netProfitMtd}
            outstandingCount={metrics.outstandingInvoices.count}
            outstandingAmount={metrics.outstandingInvoices.amount}
            revenuePrev={metrics.revenuePrev}
            expensesPrev={metrics.expensesPrev}
          />
          <RevenueChart data={metrics.sixMonths} />
        </>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg p-6 text-sm text-neutral-600">
          Financial dashboard data will appear here once your QuickBooks account is connected.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityFeed events={events} />
        {plaidIntegration && (
          <div className="bg-white border border-neutral-200 rounded-lg p-5">
            <h3 className="font-semibold mb-3">Bank accounts</h3>
            {balances.length === 0 ? (
              <p className="text-sm text-neutral-500">Balances will appear here after the next sync.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {balances.map((b) => (
                  <li key={b.accountId} className="flex justify-between border-b border-neutral-100 py-1.5">
                    <span>
                      {b.name} {b.mask && <span className="text-neutral-400">···{b.mask}</span>}
                    </span>
                    <span className="font-medium tabular-nums">
                      {b.current !== null ? formatCurrency(b.current) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {transactions.length > 0 && (
              <>
                <h4 className="text-xs uppercase text-neutral-500 mt-4 mb-2">Recent transactions</h4>
                <ul className="space-y-1.5 text-sm">
                  {transactions.map((t) => (
                    <li key={t.id} className="flex justify-between">
                      <span className="truncate pr-2">
                        <span className="text-neutral-400 mr-2">{formatDate(t.date)}</span>
                        {t.description}
                      </span>
                      <span className="tabular-nums font-medium">
                        {formatCurrency(t.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function descriptionFor(d: DocumentRow): string {
  if (d.status === "approved") return `Approved: ${d.original_filename}`;
  if (d.status === "rejected") return `Rejected: ${d.original_filename}`;
  return `Uploaded: ${d.original_filename}`;
}
