import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/utils/api";
import { requireAdmin } from "@/lib/auth/session";
import { getIntegration, setIntegrationCutover } from "@/lib/supabase/queries";

export const runtime = "nodejs";

// YYYY-MM-DD, or null to clear (disables the scope gate for this connection).
const schema = z.object({
  cutoverDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  try {
    await requireAdmin();
  } catch {
    return fail("Unauthorized", 401);
  }

  const body = (await req.json().catch(() => ({}))) as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid cutover date");

  const integ = await getIntegration(params.clientId, "quickbooks");
  if (!integ) return fail("QuickBooks is not connected for this client", 412);

  await setIntegrationCutover(params.clientId, parsed.data.cutoverDate);
  return ok({ cutoverDate: parsed.data.cutoverDate });
}
