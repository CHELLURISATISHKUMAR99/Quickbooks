import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/utils/api";
import { requireAdmin } from "@/lib/auth/session";
import {
  advanceLastProcessed,
  getClientById,
  getDocumentById,
  insertNotification,
  insertSyncLog,
  setDocumentApprovalFields,
  updateDocumentStatus,
} from "@/lib/supabase/queries";
import {
  outcomeToPersistence,
  pushDocumentToQuickBooks,
  shouldSync,
} from "@/lib/quickbooks/sync";
import { emailDocumentApproved, emailSyncFailed } from "@/lib/resend/send";
import { portalHref, portalAbsoluteHref } from "@/lib/links/portal";
import { adminAbsoluteHref } from "@/lib/links/app";

export const runtime = "nodejs";

const schema = z.object({
  amount: z.number().positive().optional(),
  postingAccountQbId: z.string().min(1).optional(),
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

  const body = (await req.json().catch(() => ({}))) as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid input");

  const doc = await getDocumentById(params.id);
  if (!doc) return fail("Not found", 404);
  if (doc.status !== "pending_review") {
    return fail(`Document is ${doc.status}, cannot approve`);
  }
  const client = await getClientById(doc.client_id);
  if (!client) return fail("Client not found", 404);

  // Non-sync categories: no amount/account required. Just mark approved.
  if (!shouldSync(doc.category)) {
    await updateDocumentStatus({
      documentId: doc.id,
      status: "approved",
      reviewedBy: "admin",
      qbSyncStatus: "not_applicable",
    });
    await sendApprovalSideEffects(doc, client);
    return ok({ documentId: doc.id });
  }

  // Sync-eligible categories: both fields are required.
  const { amount, postingAccountQbId } = parsed.data;
  if (amount === undefined || !postingAccountQbId) {
    return fail("amount and postingAccountQbId are required for this category", 400);
  }

  // Persist the approval inputs BEFORE attempting the QBO push so we
  // don't lose them if the push fails — admin can retry with the same
  // amount, or change the account.
  await setDocumentApprovalFields({
    documentId: doc.id,
    amount,
    postingAccountQbId,
  });

  const result = await pushDocumentToQuickBooks(doc, {
    amount,
    postingAccountQbId,
  }).catch((e: Error) => ({
    ok: false as const,
    friendlyError: "Couldn't post to QuickBooks. Try a different account or refresh accounts.",
    rawError: e.message,
  }));

  if (result.ok) {
    // Every non-failed outcome (pushed / duplicate / out_of_scope /
    // closed_period) is a recorded decision: the document is approved,
    // and qb_sync_status carries what actually happened with QBO.
    const persistence = outcomeToPersistence(result.outcome);
    const isHold =
      persistence.syncLogStatus === "skipped" ||
      persistence.syncLogStatus === "duplicate";
    await updateDocumentStatus({
      documentId: doc.id,
      status: "approved",
      reviewedBy: "admin",
      qbTransactionId: result.transactionId,
      qbSyncStatus: persistence.qbSyncStatus,
    });
    await insertSyncLog({
      documentId: doc.id,
      clientId: client.id,
      integrationType: "quickbooks",
      status: persistence.syncLogStatus,
      qbTransactionId: result.transactionId,
      errorMessage: isHold ? result.detail : undefined,
    });
    // Advance the resume marker so a disconnect/reconnect doesn't reprocess.
    await advanceLastProcessed(client.id, doc.uploaded_at);
    await sendApprovalSideEffects(doc, client);
    return ok({
      documentId: doc.id,
      transactionId: result.transactionId,
      outcome: result.outcome,
      detail: result.detail,
      deduped: result.deduped ?? false,
    });
  }

  // QBO push failed: do NOT change document status. Leave as
  // pending_review so admin can retry from the queue with a different
  // account. Sync log captures the failure for audit.
  await insertSyncLog({
    documentId: doc.id,
    clientId: client.id,
    integrationType: "quickbooks",
    status: "failed",
    errorMessage: result.rawError ?? result.friendlyError,
  });
  try {
    await emailSyncFailed({
      to: process.env.RESEND_REPLY_TO ?? "satish@quad4consulting.com",
      clientName: client.business_name,
      count: 1,
      adminUrl: adminAbsoluteHref("/queue?status=sync_failed"),
    });
  } catch {
    /* email failures are non-fatal */
  }
  return fail(result.friendlyError ?? "QuickBooks sync failed", 502);
}

async function sendApprovalSideEffects(
  doc: { id: string; original_filename: string },
  client: { id: string; slug: string; email: string },
): Promise<void> {
  await insertNotification({
    clientId: client.id,
    type: "approval",
    title: "Document approved",
    message: doc.original_filename,
    linkUrl: portalHref(client.slug, `/documents/${doc.id}`),
  });
  try {
    await emailDocumentApproved({
      to: client.email,
      filename: doc.original_filename,
      portalUrl: portalAbsoluteHref(client.slug, `/documents/${doc.id}`),
    });
  } catch (err) {
    console.warn("approval email failed", err);
  }
}
