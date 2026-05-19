import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/auth/session";
import { getClientById, setClientActive } from "@/lib/supabase/queries";
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

  const client = await getClientById(params.clientId);
  if (!client) return fail("Not found", 404);

  const nextActive = !client.is_active;
  await setClientActive(client.id, nextActive);

  try {
    if (nextActive) {
      await clerkClient.users.unbanUser(client.clerk_user_id);
    } else {
      await clerkClient.users.banUser(client.clerk_user_id);
    }
  } catch (err) {
    console.warn("clerk user ban toggle failed", err);
  }

  return NextResponse.redirect(new URL(`/admin/clients/${client.id}`, req.url), 303);
}
