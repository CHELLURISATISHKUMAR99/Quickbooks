import { UserButton } from "@clerk/nextjs";
import { COMPANY_NAME } from "@/lib/utils/constants";

export function AdminHeader() {
  return (
    <header className="bg-white border-b border-neutral-200">
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="q4-logo">Q4</div>
          <span className="font-semibold">{COMPANY_NAME}</span>
          <span className="text-xs uppercase tracking-wide bg-brand-50 text-brand px-2 py-0.5 rounded-full font-semibold">
            Admin
          </span>
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
