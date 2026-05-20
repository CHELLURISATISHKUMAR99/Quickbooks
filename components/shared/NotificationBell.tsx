"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NotificationRow } from "@/types";
import { timeAgo } from "@/lib/utils/format";
import { portalHref } from "@/lib/links/portal";

export function NotificationBell({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const unread = items.filter((n) => !n.is_read).length;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/notifications");
        const json = (await res.json()) as {
          success: boolean;
          data?: NotificationRow[];
        };
        if (!cancelled && json.success && json.data) setItems(json.data);
      } catch {
        /* ignore */
      }
    }
    void load();
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
  }

  // Notification link_urls come in three shapes from history:
  //   1. Legacy full subdomain URL: https://aaa.quad4consulting.com/documents/<id>
  //   2. Bare relative path: /documents/<id>  (also legacy — works on subdomain
  //      hosts via middleware rewrite but 404s on flat hosts)
  //   3. Path-prefixed: /portal/<slug>/documents/<id>  (new format)
  // Normalize all three to the path-prefixed form so a single navigation
  // works on every host (subdomain, flat preview URL, localhost).
  function toInternalHref(raw: string | null): string | null {
    if (!raw) return null;
    let pathAndQuery: string;
    if (raw.startsWith("/")) {
      pathAndQuery = raw;
    } else {
      try {
        const u = new URL(raw);
        pathAndQuery = u.pathname + u.search;
      } catch {
        return null;
      }
    }
    // Already in path-prefixed form for the current portal? Pass through.
    if (pathAndQuery.startsWith(`/portal/${slug}/`)) return pathAndQuery;
    // Otherwise treat as a relative portal path and re-anchor under this slug.
    return portalHref(slug, pathAndQuery);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-full hover:bg-neutral-100"
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-medium">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 max-h-96 overflow-auto">
          <div className="p-3 border-b border-neutral-200 font-medium text-sm">
            Notifications
          </div>
          {items.length === 0 ? (
            <div className="p-4 text-sm text-neutral-500">No notifications</div>
          ) : (
            <ul>
              {items.map((n) => {
                const internal = toInternalHref(n.link_url);
                const body = (
                  <>
                    <div className="font-medium">{n.title}</div>
                    <div className="text-neutral-600 text-xs">{n.message}</div>
                    <div className="text-neutral-400 text-xs mt-1">
                      {timeAgo(n.created_at)}
                    </div>
                  </>
                );
                const className = `block p-3 border-b border-neutral-100 text-sm hover:bg-neutral-50 cursor-pointer ${n.is_read ? "" : "bg-brand-50"}`;
                return (
                  <li key={n.id}>
                    {internal ? (
                      <Link
                        href={internal}
                        className={className}
                        onClick={() => {
                          void markRead(n.id);
                          setOpen(false);
                        }}
                      >
                        {body}
                      </Link>
                    ) : (
                      <div
                        className={className}
                        onClick={() => void markRead(n.id)}
                      >
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
