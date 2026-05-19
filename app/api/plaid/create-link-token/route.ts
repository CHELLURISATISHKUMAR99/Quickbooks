import { fail, ok } from "@/lib/utils/api";
import { requireClient } from "@/lib/auth/session";
import { getClientById } from "@/lib/supabase/queries";
import { createLinkToken } from "@/lib/plaid/sync";

export const runtime = "nodejs";

export async function POST() {
  let session;
  try {
    session = await requireClient();
  } catch {
    return fail("Unauthorized", 401);
  }
  if (!session.clientId) return fail("No client linked", 403);
  const client = await getClientById(session.clientId);
  if (!client) return fail("Client not found", 404);

  const linkToken = await createLinkToken({
    clientId: client.id,
    clientName: client.business_name,
  });
  return ok({ linkToken });
}
