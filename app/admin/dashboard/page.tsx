import { getAdminSummary } from "@/lib/supabase/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const s = await getAdminSummary();
  const cards = [
    { label: "Pending review", value: s.pendingTotal, link: "/admin/queue", tone: "amber" },
    { label: "Approved today", value: s.approvedToday, tone: "green" },
    { label: "Rejected today", value: s.rejectedToday, tone: "red" },
    { label: "Sync failed", value: s.syncFailed, link: "/admin/queue?status=sync_failed", tone: "orange" },
    { label: "Clients silent this month", value: s.clientsNoUploadsThisMonth, link: "/admin/clients", tone: "neutral" },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c) => {
          const inner = (
            <div className="bg-white border border-neutral-200 rounded-lg p-5">
              <div className="text-xs text-neutral-500 mb-1">{c.label}</div>
              <div className="text-3xl font-bold tabular-nums">{c.value}</div>
            </div>
          );
          return c.link ? (
            <Link key={c.label} href={c.link} className="block">
              {inner}
            </Link>
          ) : (
            <div key={c.label}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
