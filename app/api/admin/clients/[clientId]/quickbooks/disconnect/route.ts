import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { getServiceSupabase } from "@/lib/supabase/server";
import { fail } from "@/lib/utils/api";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  try {
    await requireAdmin();
  } catch {
    return fail("Unauthorized", 401);
  }
  const sb = getServiceSupabase();
  await sb
    .from("client_integrations")
    .delete()
    .eq("client_id", params.clientId)
    .eq("integration_type", "quickbooks");
  return NextResponse.redirect(
    new URL(`/admin/clients/${params.clientId}`, req.url),
    303,
  );
}
