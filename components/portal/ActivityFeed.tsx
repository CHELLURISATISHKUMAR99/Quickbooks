import Link from "next/link";
import { timeAgo } from "@/lib/utils/format";

export interface ActivityEvent {
  id: string;
  type: "uploaded" | "approved" | "rejected" | "report" | "bank";
  description: string;
  at: string;
  href?: string;
}

const COLOR: Record<ActivityEvent["type"], string> = {
  uploaded: "bg-blue-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  report: "bg-brand",
  bank: "bg-amber-500",
};

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-5">
      <h3 className="font-semibold mb-4">Recent activity</h3>
      {events.length === 0 ? (
        <p className="text-sm text-neutral-500">No recent activity</p>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => {
            const inner = (
              <>
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${COLOR[e.type]}`}
                />
                <div className="flex-1">
                  <div className="text-neutral-800">{e.description}</div>
                  <div className="text-xs text-neutral-400">
                    {timeAgo(e.at)}
                  </div>
                </div>
              </>
            );
            return (
              <li key={e.id} className="text-sm">
                {e.href ? (
                  <Link
                    href={e.href}
                    className="flex items-start gap-3 -mx-2 px-2 py-1 rounded hover:bg-neutral-50"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
