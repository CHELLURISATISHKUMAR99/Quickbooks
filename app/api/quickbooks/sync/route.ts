import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { fail, ok } from "@/lib/utils/api";
import {
  getDocumentById,
  insertSyncLog,
  updateDocumentStatus,
} from "@/lib/supabase/queries";
import { pushDocumentToQuickBooks } from "@/lib/quickbooks/sync";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return fail("Unauthorized", 401);
  }
  const { documentId } = (await req.json().catch(() => ({}))) as {
    documentId?: string;
  };
  if (!documentId) return fail("documentId required");
  const doc = await getDocumentById(documentId);
  if (!doc) return fail("Not found", 404);

  const result = await pushDocumentToQuickBooks(doc).catch(
    (e: Error): import("@/lib/quickbooks/sync").QbPushResult => ({
      ok: false,
      error: e.message,
    }),
  );

  if (result.ok) {
    await updateDocumentStatus({
      documentId: doc.id,
      status: "approved",
      qbTransactionId: result.transactionId,
      qbSyncStatus: "success",
    });
    await insertSyncLog({
      documentId: doc.id,
      clientId: doc.client_id,
      integrationType: "quickbooks",
      status: "success",
      qbTransactionId: result.transactionId,
    });
    return ok({ transactionId: result.transactionId });
  }
  await updateDocumentStatus({
    documentId: doc.id,
    status: "sync_failed",
    qbSyncStatus: "failed",
  });
  await insertSyncLog({
    documentId: doc.id,
    clientId: doc.client_id,
    integrationType: "quickbooks",
    status: "failed",
    errorMessage: result.error,
  });
  return fail(result.error ?? "Sync failed", 500);
}
