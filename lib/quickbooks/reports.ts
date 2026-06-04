import { getValidAccessToken, qbApiBase } from "./auth";
import type { ReportType } from "@/types";

const REPORT_PATH: Record<ReportType, string> = {
  pnl: "ProfitAndLoss",
  expense_summary: "ProfitAndLossDetail",
  cash_flow: "CashFlow",
};

export interface QbReportRow {
  label: string;
  amount: number;
}

export interface QbReport {
  type: ReportType;
  start: string;
  end: string;
  rows: QbReportRow[];
  totals: { revenue: number; expenses: number; net: number };
  raw: unknown;
}

interface QbReportApiRow {
  ColData?: { value: string }[];
  Rows?: { Row?: QbReportApiRow[] };
  type?: string;
  Summary?: { ColData?: { value: string }[] };
}

interface QbReportApiResponse {
  Rows?: { Row?: QbReportApiRow[] };
  Header?: { StartPeriod?: string; EndPeriod?: string };
}

// Default reporting window when a caller doesn't pass one: the current
// calendar month. Keeps every report bounded so a missing/empty range can
// never silently run all-time and pull in old/junk transactions.
function currentPeriod(): { start: string; end: string } {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10),
  };
}

export async function fetchReport(input: {
  clientId: string;
  type: ReportType;
  start?: string;
  end?: string;
}): Promise<QbReport> {
  // Resolve the date range first: explicit start+end if given, otherwise
  // default to the current period. The QBO Reports API is always called
  // WITH start_date/end_date, so it never returns an all-time report.
  const period = currentPeriod();
  const start = input.start || period.start;
  const end = input.end || period.end;

  const { accessToken, realmId } = await getValidAccessToken(input.clientId);
  const url = `${qbApiBase()}/v3/company/${realmId}/reports/${REPORT_PATH[input.type]}?start_date=${start}&end_date=${end}&minorversion=70`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`QB report failed: ${res.status}`);
  const json = (await res.json()) as QbReportApiResponse;
  const rows = flattenRows(json.Rows?.Row ?? []);
  const revenue = sumByLabel(rows, ["income", "revenue", "total income"]);
  const expenses = sumByLabel(rows, ["expense", "expenses", "total expenses"]);
  // ⚠️ SUSPECTED BUG (the −$80 "Net"): `revenue`/`expenses` are computed by
  // loose case-insensitive SUBSTRING matching over `flattenRows`, which
  // collects line items AND their section Summary rows AND QBO's own
  // "Net …" summaries. So:
  //   • "Net Income" / "Net Operating Income" / "Net Other Income" all
  //     contain "income" → they get summed into `revenue`.
  //   • each line item is double-counted against its "Total …" summary.
  // net = revenue − expenses therefore inherits that pollution. Flagged
  // for review — NOT fixed here (see PR description for the proposed fix:
  // read QBO's labeled summary/group rows instead of substring-summing).
  return {
    type: input.type,
    start,
    end,
    rows,
    totals: { revenue, expenses, net: revenue - expenses },
    raw: json,
  };
}

function flattenRows(rows: QbReportApiRow[]): QbReportRow[] {
  const out: QbReportRow[] = [];
  for (const r of rows) {
    if (r.ColData && r.ColData.length >= 2) {
      const label = r.ColData[0]?.value ?? "";
      const amt = parseFloat(r.ColData[r.ColData.length - 1]?.value ?? "0");
      if (label) out.push({ label, amount: isNaN(amt) ? 0 : amt });
    }
    if (r.Summary?.ColData) {
      const label = r.Summary.ColData[0]?.value ?? "";
      const amt = parseFloat(
        r.Summary.ColData[r.Summary.ColData.length - 1]?.value ?? "0",
      );
      if (label) out.push({ label, amount: isNaN(amt) ? 0 : amt });
    }
    if (r.Rows?.Row) out.push(...flattenRows(r.Rows.Row));
  }
  return out;
}

function sumByLabel(rows: QbReportRow[], needles: string[]): number {
  return rows
    .filter((r) =>
      needles.some((n) => r.label.toLowerCase().includes(n.toLowerCase())),
    )
    .reduce((s, r) => s + r.amount, 0);
}

export interface DashboardMetrics {
  revenueMtd: number;
  expensesMtd: number;
  netProfitMtd: number;
  outstandingInvoices: { count: number; amount: number };
  revenuePrev: number;
  expensesPrev: number;
  sixMonths: { month: string; revenue: number; expenses: number }[];
  asOf: string;
}

export async function fetchDashboardMetrics(
  clientId: string,
): Promise<DashboardMetrics> {
  const now = new Date();
  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const mtdEnd = now.toISOString().slice(0, 10);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 10);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    .toISOString()
    .slice(0, 10);

  const [current, previous] = await Promise.all([
    fetchReport({ clientId, type: "pnl", start: mtdStart, end: mtdEnd }),
    fetchReport({ clientId, type: "pnl", start: prevStart, end: prevEnd }),
  ]);

  const sixMonths: { month: string; revenue: number; expenses: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const r = await fetchReport({
      clientId,
      type: "pnl",
      start: s.toISOString().slice(0, 10),
      end: e.toISOString().slice(0, 10),
    });
    sixMonths.push({
      month: s.toLocaleString("en-US", { month: "short" }),
      revenue: r.totals.revenue,
      expenses: r.totals.expenses,
    });
  }

  const invoices = await fetchOutstandingInvoices(clientId);

  return {
    revenueMtd: current.totals.revenue,
    expensesMtd: current.totals.expenses,
    netProfitMtd: current.totals.net,
    outstandingInvoices: invoices,
    revenuePrev: previous.totals.revenue,
    expensesPrev: previous.totals.expenses,
    sixMonths,
    asOf: new Date().toISOString(),
  };
}

interface QbInvoiceQueryResponse {
  QueryResponse?: {
    Invoice?: { Balance?: number }[];
  };
}

async function fetchOutstandingInvoices(
  clientId: string,
): Promise<{ count: number; amount: number }> {
  const { accessToken, realmId } = await getValidAccessToken(clientId);
  const query = "SELECT * FROM Invoice WHERE Balance > '0'";
  const url = `${qbApiBase()}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=70`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) return { count: 0, amount: 0 };
  const json = (await res.json()) as QbInvoiceQueryResponse;
  const invs = json.QueryResponse?.Invoice ?? [];
  return {
    count: invs.length,
    amount: invs.reduce((s, i) => s + (i.Balance ?? 0), 0),
  };
}
