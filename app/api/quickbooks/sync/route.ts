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

// Retry endpoint: re-pushes an already-approved document that previously
// failed to sync. Reads the persisted amount + posting_account_qb_id
// from the document row rather than taking them in the body so we never
// accept a fresh amount via a retry surface.
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
  if (doc.amount === null || !doc.posting_account_qb_id) {
    return fail(
      "Document has no amount/account set — re-approve from the queue instead.",
      400,
    );
  }

  const result = await pushDocumentToQuickBooks(doc, {
    amount: doc.amount,
    postingAccountQbId: doc.posting_account_qb_id,
  }).catch((e: Error) => ({
    ok: false as const,
    friendlyError: "Couldn't post to QuickBooks. Try a different account or refresh accounts.",
    rawError: e.message,
  }));

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
    return ok({
      transactionId: result.transactionId,
      deduped: result.deduped ?? false,
    });
  }
  await insertSyncLog({
    documentId: doc.id,
    clientId: doc.client_id,
    integrationType: "quickbooks",
    status: "failed",
    errorMessage: result.rawError ?? result.friendlyError,
  });
  return fail(result.friendlyError ?? "Sync failed", 502);
}
