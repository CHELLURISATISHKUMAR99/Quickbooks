import { NextRequest } from "next/server";
import { fail } from "@/lib/utils/api";
import { getSession } from "@/lib/auth/session";
import { getClientById } from "@/lib/supabase/queries";
import { getServiceSupabase } from "@/lib/supabase/server";
import { fetchReport } from "@/lib/quickbooks/reports";
import { renderReportPdf } from "@/lib/reports/pdf";
import type { ReportRow } from "@/types";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("reports")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error || !data) return fail("Not found", 404);
  const report = data as ReportRow;

  if (
    session.role !== "admin" &&
    (session.role !== "client" || session.clientId !== report.client_id)
  ) {
    return fail("Forbidden", 403);
  }

  const client = await getClientById(report.client_id);
  if (!client) return fail("Client not found", 404);

  const q = await fetchReport({
    clientId: client.id,
    type: report.report_type,
    start: report.date_range_start,
    end: report.date_range_end,
  });

  const pdf = await renderReportPdf({
    businessName: client.business_name,
    reportType: report.report_type,
    start: report.date_range_start,
    end: report.date_range_end,
    rows: q.rows,
    totals: q.totals,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report-${report.report_type}-${report.date_range_start}.pdf"`,
    },
  });
}
