import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { exchangeCodeForTokens, saveTokens } from "@/lib/quickbooks/auth";
import { syncAccountsForClient } from "@/lib/quickbooks/accounts";
import { fail } from "@/lib/utils/api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return fail("Unauthorized", 401);
  }
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const realmId = req.nextUrl.searchParams.get("realmId");
  if (!code || !state || !realmId) return fail("Missing OAuth params");

  const tokens = await exchangeCodeForTokens(code);
  await saveTokens(state, tokens, realmId);

  // Fire-and-forget initial accounts sync. If it fails the admin can
  // refresh manually from the modal — don't block the OAuth round-trip.
  syncAccountsForClient(state).catch((err) => {
    console.warn(
      `Initial QBO accounts sync failed for client ${state}:`,
      (err as Error).message,
    );
  });

  return NextResponse.redirect(new URL(`/admin/clients/${state}`, req.url));
}
