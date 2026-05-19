import { fail, ok } from "@/lib/utils/api";
import { requireClient } from "@/lib/auth/session";
import { listNotifications } from "@/lib/supabase/queries";

export const runtime = "nodejs";

export async function GET() {
  let session;
  try {
    session = await requireClient();
  } catch {
    return fail("Unauthorized", 401);
  }
  if (!session.clientId) return fail("No client linked", 403);
  const items = await listNotifications(session.clientId);
  return ok(items);
}
