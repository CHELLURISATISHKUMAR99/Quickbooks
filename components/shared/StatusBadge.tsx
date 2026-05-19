import {
  DOCUMENT_STATUS_LABEL,
  STATUS_BADGE_CLASS,
} from "@/lib/utils/constants";
import type { DocumentStatus } from "@/types";

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}
    >
      {DOCUMENT_STATUS_LABEL[status]}
    </span>
  );
}
