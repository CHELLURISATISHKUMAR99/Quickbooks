"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPANY_NAME } from "@/lib/utils/constants";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload Documents" },
  { href: "/documents", label: "My Documents" },
  { href: "/reports", label: "Reports" },
  { href: "/messages", label: "Messages" },
  { href: "/settings", label: "Settings" },
];

export function PortalSidebar() {
  const pathname = usePathname() ?? "";
  return (
    <aside className="w-60 bg-white border-r border-neutral-200 flex flex-col">
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const active = pathname.endsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
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
