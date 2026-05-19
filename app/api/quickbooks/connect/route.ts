import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { getAuthorizationUrl } from "@/lib/quickbooks/auth";
import { fail } from "@/lib/utils/api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return fail("Unauthorized", 401);
  }
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return fail("clientId required");
  const url = getAuthorizationUrl(clientId);
  return NextResponse.redirect(url);
}
