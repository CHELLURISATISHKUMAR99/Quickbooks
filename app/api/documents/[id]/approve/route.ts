import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/utils/api";
import { requireAdmin } from "@/lib/auth/session";
import {
  getClientById,
  getDocumentById,
  insertNotification,
  insertSyncLog,
  updateDocumentStatus,
} from "@/lib/supabase/queries";
import { pushDocumentToQuickBooks, shouldSync } from "@/lib/quickbooks/sync";
import { emailDocumentApproved, emailSyncFailed } from "@/lib/resend/send";

export const runtime = "nodejs";

export async function POST(
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
  if (doc.status !== "pending_review") {
    return fail(`Document is ${doc.status}, cannot approve`);
  }
  const client = await getClientById(doc.client_id);
  if (!client) return fail("Client not found", 404);

  if (!shouldSync(doc.category)) {
    await updateDocumentStatus({
      documentId: doc.id,
      status: "approved",
      reviewedBy: "admin",
      qbSyncStatus: "not_applicable",
    });
  } else {
    await updateDocumentStatus({
      documentId: doc.id,
      status: "approved",
      reviewedBy: "admin",
      qbSyncStatus: "pending",
    });
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
        clientId: client.id,
        integrationType: "quickbooks",
        status: "success",
        qbTransactionId: result.transactionId,
      });
    } else {
      await updateDocumentStatus({
        documentId: doc.id,
        status: "sync_failed",
        qbSyncStatus: "failed",
      });
      await insertSyncLog({
        documentId: doc.id,
        clientId: client.id,
        integrationType: "quickbooks",
        status: "failed",
        errorMessage: result.error,
      });
      try {
        await emailSyncFailed({
          to: process.env.RESEND_REPLY_TO ?? "satish@quad4consulting.com",
          clientName: client.business_name,
          count: 1,
          adminUrl: `https://admin.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "quad4consulting.com"}/queue?status=sync_failed`,
        });
      } catch {
        /* ignore */
      }
    }
  }

  await insertNotification({
    clientId: client.id,
    type: "approval",
    title: "Document approved",
    message: doc.original_filename,
    linkUrl: `https://${client.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "quad4consulting.com"}/documents/${doc.id}`,
  });

  try {
    await emailDocumentApproved({
      to: client.email,
      filename: doc.original_filename,
      portalUrl: `https://${client.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "quad4consulting.com"}/documents`,
    });
  } catch (err) {
    console.warn("approval email failed", err);
  }

  return ok({ documentId: doc.id });
}
