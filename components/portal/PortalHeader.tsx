import { UserButton } from "@clerk/nextjs";
import { COMPANY_NAME } from "@/lib/utils/constants";
import { initialsFromName } from "@/lib/utils/slug";
import { NotificationBell } from "@/components/shared/NotificationBell";

export function PortalHeader({
  businessName,
  booksUpToDate,
}: {
  businessName: string;
  booksUpToDate: boolean;
}) {
  return (
    <header className="bg-white border-b border-neutral-200">
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="q4-logo">Q4</div>
            <span className="font-semibold text-sm hidden sm:inline">
              {COMPANY_NAME}
            </span>
          </div>
          <div className="h-8 w-px bg-neutral-200" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center text-xs font-semibold">
              {initialsFromName(businessName)}
            </div>
            <span className="font-medium text-sm">{businessName}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs px-2 py-1 rounded-full border ${
              booksUpToDate
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {booksUpToDate ? "Books up to date" : "Action needed"}
          </span>
          <NotificationBell />
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  );
}
