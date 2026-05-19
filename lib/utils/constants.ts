import type { DocumentCategory, DocumentStatus, ReportType } from "@/types";

export const COMPANY_NAME = "Quad 4 Consulting Services";
export const COMPANY_SHORT = "Quad 4";
export const ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "quad4consulting.com";

export const BRAND_COLOR = "#185FA5";
export const BRAND_NEUTRAL = "#D3D1C7";

export const DOCUMENT_CATEGORIES: {
  value: DocumentCategory;
  label: string;
  description: string;
  qbSync: boolean;
}[] = [
  {
    value: "receipts",
    label: "Receipts",
    description: "Cash out — purchases, bills, vendor payments",
    qbSync: true,
  },
  {
    value: "sales",
    label: "Sales / Cash In",
    description: "Income, sales receipts, payment confirmations",
    qbSync: true,
  },
  {
    value: "bank_statements",
    label: "Bank Statements",
    description: "Monthly statements (never auto-pushed)",
    qbSync: false,
  },
  {
    value: "payroll",
    label: "Payroll Records",
    description: "Timesheets, payslips, contractor invoices",
    qbSync: true,
  },
  {
    value: "tax_documents",
    label: "Tax Documents",
    description: "W-2, 1099, prior returns, IRS notices",
    qbSync: false,
  },
  {
    value: "other",
    label: "Other",
    description: "Contracts, agreements, anything else",
    qbSync: false,
  },
];

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  sync_failed: "Sync Failed",
};

export const STATUS_BADGE_CLASS: Record<DocumentStatus, string> = {
  pending_review: "bg-amber-100 text-amber-800 border-amber-300",
  approved: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  sync_failed: "bg-orange-100 text-orange-800 border-orange-300",
};

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  pnl: "Profit & Loss",
  expense_summary: "Expense Summary",
  cash_flow: "Cash Flow",
};

export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];
export const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png"];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const UPLOAD_RATE_LIMIT_PER_HOUR = 20;
export const SIGNED_URL_TTL_SECONDS = 3600;
export const DASHBOARD_CACHE_MINUTES = 30;

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthName(m: number): string {
  return MONTHS[m - 1] ?? String(m);
}
