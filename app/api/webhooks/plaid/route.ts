import { NextRequest } from "next/server";
import { ok } from "@/lib/utils/api";
import { dailySync } from "@/lib/plaid/sync";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface PlaidWebhook {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as PlaidWebhook;
  if (body.webhook_type === "TRANSACTIONS" && body.item_id) {
    const sb = getServiceSupabase();
    const { data } = await sb
      .from("client_integrations")
      .select("client_id")
      .eq("plaid_item_id", body.item_id)
      .maybeSingle();
    if (data?.client_id) {
      try {
        await dailySync(data.client_id);
      } catch (err) {
        console.warn("plaid webhook sync failed", err);
      }
    }
  }
  return ok({ received: true });
}
