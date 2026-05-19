import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/utils/api";
import { requireClient } from "@/lib/auth/session";
import { exchangePublicToken } from "@/lib/plaid/sync";

export const runtime = "nodejs";

const schema = z.object({ publicToken: z.string().min(1) });

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
  await exchangePublicToken({
    clientId: session.clientId,
    publicToken: parsed.data.publicToken,
  });
  return ok({ connected: true });
}
