import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/utils/api";
import { requireAdmin } from "@/lib/auth/session";
import {
  getClientById,
  getDocumentById,
  insertNotification,
  updateDocumentStatus,
} from "@/lib/supabase/queries";
import { emailDocumentRejected } from "@/lib/resend/send";
import { portalHref, portalAbsoluteHref } from "@/lib/links/portal";

export const runtime = "nodejs";

const schema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
  } catch {
    return fail("Unauthorized", 401);
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid");

  const doc = await getDocumentById(params.id);
  if (!doc) return fail("Not found", 404);
  if (doc.status !== "pending_review") {
    return fail(`Document is ${doc.status}`);
  }
  const client = await getClientById(doc.client_id);
  if (!client) return fail("Client not found", 404);

  await updateDocumentStatus({
    documentId: doc.id,
    status: "rejected",
    rejectionReason: parsed.data.reason,
    reviewedBy: "admin",
  });

  await insertNotification({
    clientId: client.id,
    type: "rejection",
    title: "Document rejected",
    message: `${doc.original_filename} — ${parsed.data.reason}`,
    linkUrl: portalHref(client.slug, `/documents/${doc.id}`),
  });

  try {
    await emailDocumentRejected({
      to: client.email,
      filename: doc.original_filename,
      reason: parsed.data.reason,
      portalUrl: portalAbsoluteHref(client.slug, "/upload"),
    });
  } catch (err) {
    console.warn("rejection email failed", err);
  }

  return ok({ documentId: doc.id });
}
