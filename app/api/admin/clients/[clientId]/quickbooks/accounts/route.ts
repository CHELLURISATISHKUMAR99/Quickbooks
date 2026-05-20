import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/utils/api";
import { requireAdmin } from "@/lib/auth/session";
import {
  countCachedAccounts,
  listClientQbAccounts,
} from "@/lib/supabase/queries";
import { syncAccountsForClient } from "@/lib/quickbooks/accounts";
import type { QbAccountClassification } from "@/types";

export const runtime = "nodejs";

const VALID_CLASSIFICATIONS = new Set<QbAccountClassification>([
  "Asset",
  "Equity",
  "Expense",
  "Liability",
  "Revenue",
]);

export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  try {
    await requireAdmin();
  } catch {
    return fail("Unauthorized", 401);
  }
  const classRaw = req.nextUrl.searchParams.get("classification");
  const classification =
    classRaw && VALID_CLASSIFICATIONS.has(classRaw as QbAccountClassification)
      ? (classRaw as QbAccountClassification)
      : undefined;
  const [accounts, summary] = await Promise.all([
    listClientQbAccounts(params.clientId, { classification }),
    countCachedAccounts(params.clientId),
  ]);
  return ok({
    accounts: accounts.map((a) => ({
      qbAccountId: a.qb_account_id,
      name: a.name,
      fullyQualifiedName: a.fully_qualified_name,
      accountType: a.account_type,
      accountSubType: a.account_sub_type,
      classification: a.classification,
    })),
    total: summary.total,
    lastSyncedAt: summary.lastSyncedAt,
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  try {
    await requireAdmin();
  } catch {
    return fail("Unauthorized", 401);
  }
  try {
    const synced = await syncAccountsForClient(params.clientId);
    const summary = await countCachedAccounts(params.clientId);
    return ok({
      synced,
      total: summary.total,
      lastSyncedAt: summary.lastSyncedAt,
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("not connected")) return fail(msg, 412);
    return fail(`Refresh failed: ${msg}`, 502);
  }
}
