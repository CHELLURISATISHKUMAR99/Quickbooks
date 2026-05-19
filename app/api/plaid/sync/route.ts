import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/utils/api";
import { dailySync } from "@/lib/plaid/sync";
import { listClients } from "@/lib/supabase/queries";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ""}`) {
    return fail("Unauthorized", 401);
  }
  const clients = await listClients();
  let total = 0;
  const errors: string[] = [];
  for (const c of clients) {
    try {
      const count = await dailySync(c.id);
      total += count;
    } catch (err) {
      errors.push(`${c.business_name}: ${(err as Error).message}`);
    }
  }
  return ok({ syncedTransactions: total, errors });
}
