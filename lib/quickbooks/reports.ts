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
  Header?: { ColData?: { value: string }[] };
  ColData?: { value: string }[];
  Rows?: { Row?: QbReportApiRow[] };
  // QBO tags each P&L section with a stable `group`, and its `Summary`
  // carries QBO's own computed total for that section. We read those
  // directly rather than re-deriving totals by matching labels.
  type?: string;
  group?: string;
  Summary?: { ColData?: { value: string }[] };
}

// P&L section groups whose Summary total is authoritative (QBO-computed).
const PNL_REVENUE_GROUP = "Income";
const PNL_EXPENSE_GROUP = "Expenses";
const PNL_NET_GROUP = "NetIncome";

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

  // Single structured pass: collect leaf line items for display and record
  // each section's QBO-computed Summary total by group. We never treat a
  // Summary row as a line item and never sum line items against their
  // section totals — that double-counting + "Net … contains 'income'"
  // contamination was the old −$80 bug.
  const rows: QbReportRow[] = [];
  const sections = new Map<string, number>();
  walkReport(json.Rows?.Row ?? [], rows, sections);

  const netIncome = sections.get(PNL_NET_GROUP);
  let revenue: number;
  let expenses: number;
  let net: number;

  if (netIncome !== undefined) {
    // ProfitAndLoss-shaped report: surface QBO's own computed totals.
    revenue = sections.get(PNL_REVENUE_GROUP) ?? 0;
    expenses = sections.get(PNL_EXPENSE_GROUP) ?? 0;
    net = netIncome; // authoritative — NOT recomputed from labels.
  } else if (input.type === "pnl") {
    // We asked for a P&L but got no NetIncome summary — the structure
    // changed or the response is malformed. Refuse rather than surface an
    // unverified Net.
    throw new Error(
      "QBO ProfitAndLoss returned no NetIncome summary row — cannot produce a verified Net",
    );
  } else {
    // Non-P&L report (e.g. Cash Flow) has no Income/Expenses/NetIncome
    // groups. Fall back to summing leaf line items only — still free of the
    // summary/double-count contamination, since `rows` excludes summaries.
    revenue = sumByLabel(rows, ["income", "revenue"]);
    expenses = sumByLabel(rows, ["expense", "expenses"]);
    net = revenue - expenses;
  }

  // Sanity check: for a P&L, the Net we surface MUST equal QBO's own
  // NetIncome summary row. Guards against any future regression that
  // recomputes Net by summing labels again.
  if (netIncome !== undefined && Math.abs(net - netIncome) >= 0.005) {
    throw new Error(
      `P&L Net (${net}) does not match QBO NetIncome summary (${netIncome})`,
    );
  }

  return {
    type: input.type,
    start,
    end,
    rows,
    totals: { revenue, expenses, net },
    raw: json,
  };
}

function rowAmount(colData?: { value: string }[]): number {
  if (!colData || colData.length === 0) return 0;
  const amt = parseFloat(colData[colData.length - 1]?.value ?? "0");
  return isNaN(amt) ? 0 : amt;
}

// One pass over the report tree:
//  • record each section's QBO-computed Summary total, keyed by `group`
//    (Income / Expenses / GrossProfit / NetOperatingIncome / NetIncome /
//    NetOtherIncome / COGS / …);
//  • collect leaf "Data" rows (no child Rows) as displayable line items.
// Section rows and Summary-only rows are NOT added as line items.
function walkReport(
  apiRows: QbReportApiRow[],
  lineItems: QbReportRow[],
  sections: Map<string, number>,
): void {
  for (const r of apiRows) {
    if (r.group && r.Summary?.ColData) {
      sections.set(r.group, rowAmount(r.Summary.ColData));
    }
    if (r.Rows?.Row) {
      walkReport(r.Rows.Row, lineItems, sections);
    } else if (r.ColData && r.ColData.length >= 2) {
      const label = r.ColData[0]?.value ?? "";
      if (label) lineItems.push({ label, amount: rowAmount(r.ColData) });
    }
  }
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
