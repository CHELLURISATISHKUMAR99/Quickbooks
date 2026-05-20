"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPANY_NAME } from "@/lib/utils/constants";
import { portalHref } from "@/lib/links/portal";

const NAV = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/upload", label: "Upload Documents" },
  { path: "/documents", label: "My Documents" },
  { path: "/reports", label: "Reports" },
  { path: "/messages", label: "Messages" },
  { path: "/settings", label: "Settings" },
];

export function PortalSidebar({ slug }: { slug: string }) {
  const pathname = usePathname() ?? "";
  return (
    <aside className="w-60 bg-white border-r border-neutral-200 flex flex-col">
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const active = pathname.endsWith(item.path);
          return (
            <Link
              key={item.path}
              href={portalHref(slug, item.path)}
              className={`block px-3 py-2 rounded-md text-sm ${
                active
                  ? "bg-brand-50 text-brand font-medium"
                  : "text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 text-xs text-neutral-400 border-t border-neutral-200">
        Secured by {COMPANY_NAME}
      </div>
    </aside>
  );
}
