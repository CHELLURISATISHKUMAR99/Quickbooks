import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { exchangeCodeForTokens, saveTokens } from "@/lib/quickbooks/auth";
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
  return NextResponse.redirect(new URL(`/admin/clients/${state}`, req.url));
}
