import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/utils/api";
import { requireClient } from "@/lib/auth/session";
import { fetchReport } from "@/lib/quickbooks/reports";
import { insertReport } from "@/lib/supabase/queries";

export const runtime = "nodejs";

const schema = z.object({
  type: z.enum(["pnl", "expense_summary", "cash_flow"]),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireClient();
  } catch {
    return fail("Unauthorized", 401);
  }
  if (!session.clientId) return fail("No client linked", 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid input");

  const report = await fetchReport({
    clientId: session.clientId,
    type: parsed.data.type,
    start: parsed.data.start,
    end: parsed.data.end,
  });

  const row = await insertReport({
    clientId: session.clientId,
    reportType: parsed.data.type,
    dateRangeStart: parsed.data.start,
    dateRangeEnd: parsed.data.end,
  });

  return ok({
    reportId: row.id,
    report: { rows: report.rows, totals: report.totals },
  });
}
