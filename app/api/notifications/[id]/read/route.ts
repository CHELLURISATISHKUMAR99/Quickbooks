import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/utils/api";
import { requireClient } from "@/lib/auth/session";
import { markNotificationRead } from "@/lib/supabase/queries";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireClient();
  } catch {
    return fail("Unauthorized", 401);
  }
  await markNotificationRead(params.id);
  return ok({ id: params.id });
}
