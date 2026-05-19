import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/utils/api";
import { requireAdmin } from "@/lib/auth/session";
import {
  getDocumentById,
  getSignedDocumentUrl,
} from "@/lib/supabase/queries";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
  } catch {
    return fail("Unauthorized", 401);
  }
  const doc = await getDocumentById(params.id);
  if (!doc) return fail("Not found", 404);
  const url = await getSignedDocumentUrl(doc.storage_path);
  return NextResponse.redirect(url);
}
