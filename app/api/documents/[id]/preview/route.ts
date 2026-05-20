import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/utils/api";
import { requireClient } from "@/lib/auth/session";
import {
  getDocumentById,
  getSignedDocumentUrl,
} from "@/lib/supabase/queries";
import { PREVIEW_URL_TTL_SECONDS } from "@/lib/utils/constants";

export const runtime = "nodejs";

// Mints a short-lived signed URL on every hit and 302s to it. Used by
// the detail page's <iframe>/<img>/<a> src so signed URLs never live in
// the rendered HTML and any link copied out of the page goes stale fast.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  let session;
  try {
    session = await requireClient();
  } catch {
    return fail("Unauthorized", 401);
  }
  const doc = await getDocumentById(params.id);
  // 404 (not 403) on tenant mismatch — same response for "doesn't exist"
  // and "exists but not yours" so existence isn't leaked.
  if (!doc || doc.client_id !== session.clientId) {
    return fail("Not found", 404);
  }
  try {
    const url = await getSignedDocumentUrl(
      doc.storage_path,
      PREVIEW_URL_TTL_SECONDS,
    );
    return NextResponse.redirect(url);
  } catch {
    return fail("File unavailable", 404);
  }
}
