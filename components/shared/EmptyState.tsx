import type { ReactNode } from "react";

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-2 border-dashed border-neutral-200 rounded-lg p-12 text-center bg-white">
      <h3 className="text-lg font-semibold text-neutral-800 mb-1">{title}</h3>
      <p className="text-sm text-neutral-500 mb-4">{message}</p>
      {action}
    </div>
  );
}
