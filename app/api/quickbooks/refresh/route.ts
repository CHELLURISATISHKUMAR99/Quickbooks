import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/utils/api";
import { listClients } from "@/lib/supabase/queries";
import { getValidAccessToken } from "@/lib/quickbooks/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ""}`) {
    return fail("Unauthorized", 401);
  }
  const clients = await listClients();
  const errors: string[] = [];
  for (const c of clients) {
    try {
      await getValidAccessToken(c.id);
    } catch (err) {
      errors.push(`${c.business_name}: ${(err as Error).message}`);
    }
  }
  return ok({ refreshed: clients.length, errors });
}
