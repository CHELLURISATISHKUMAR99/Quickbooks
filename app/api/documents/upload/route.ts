import { NextRequest } from "next/server";
import { z } from "zod";
import { fileTypeFromBuffer } from "file-type";
import { fail, ok } from "@/lib/utils/api";
import { requireClient } from "@/lib/auth/session";
import { getServiceSupabase, DOCUMENTS_BUCKET } from "@/lib/supabase/server";
import {
  countUploadsLastHour,
  getClientById,
  getDocumentById,
  insertDocument,
  insertNotification,
  replaceDocumentRpc,
} from "@/lib/supabase/queries";
import {
  ALLOWED_MIME,
  MAX_FILE_SIZE_BYTES,
  UPLOAD_RATE_LIMIT_PER_HOUR,
  monthName,
} from "@/lib/utils/constants";
import { emailUploadNotification } from "@/lib/resend/send";
import { randomUUID } from "crypto";
import type { DocumentCategory } from "@/types";

export const runtime = "nodejs";

const schema = z.object({
  category: z.enum([
    "receipts",
    "sales",
    "bank_statements",
    "payroll",
    "tax_documents",
    "other",
  ]),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2030),
});

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireClient();
  } catch {
    return fail("Unauthorized", 401);
  }
  if (!session.clientId) return fail("No client linked", 403);

  const client = await getClientById(session.clientId);
  if (!client || !client.is_active) return fail("Account inactive", 403);

  const recent = await countUploadsLastHour(client.id);
  if (recent >= UPLOAD_RATE_LIMIT_PER_HOUR) {
    return fail("Upload rate limit reached. Try again later.", 429);
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Missing file");

  const parsed = schema.safeParse({
    category: form.get("category"),
    month: Number(form.get("month")),
    year: Number(form.get("year")),
  });
  if (!parsed.success) return fail("Invalid form data");
  const { category, month, year } = parsed.data;

  const replacesRaw = form.get("replaces");
  const replacesId =
    typeof replacesRaw === "string" && replacesRaw.length > 0
      ? replacesRaw
      : null;
  let oldDoc: Awaited<ReturnType<typeof getDocumentById>> = null;
  if (replacesId) {
    oldDoc = await getDocumentById(replacesId);
    // 404 on missing OR on cross-tenant mismatch — same response either
    // way so we don't leak existence of other tenants' docs.
    if (!oldDoc || oldDoc.client_id !== client.id) {
      return fail("Not found", 404);
    }
    if (oldDoc.status === "replaced" || oldDoc.replaced_by_id) {
      return fail("Document already replaced", 409);
    }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) return fail("File too large (max 10MB)");

  const buf = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buf);
  const mime = detected?.mime ?? file.type;
  if (!ALLOWED_MIME.includes(mime)) {
    return fail("Unsupported file type. Only PDF, JPG, PNG allowed.");
  }

  const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
  const stored = `${randomUUID()}.${ext}`;
  const storagePath = `clients/${client.id}/${year}/${String(month).padStart(2, "0")}/${category}/${stored}`;

  const sb = getServiceSupabase();
  const { error: upErr } = await sb.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, buf, { contentType: mime, upsert: false });
  if (upErr) return fail(`Upload failed: ${upErr.message}`, 500);

  let doc;
  if (oldDoc) {
    try {
      doc = await replaceDocumentRpc({
        oldDocumentId: oldDoc.id,
        clientId: client.id,
        filename: stored,
        originalFilename: file.name,
        storagePath,
        fileSizeBytes: file.size,
        mimeType: mime,
        category: category as DocumentCategory,
        month,
        year,
      });
    } catch (err) {
      // RPC failed after upload — orphan the uploaded blob rather than
      // leaving the replacement chain in an inconsistent state.
      await sb.storage.from(DOCUMENTS_BUCKET).remove([storagePath]).catch(() => {
        /* best-effort cleanup */
      });
      const msg = (err as { message?: string }).message ?? "Replace failed";
      const code = msg.includes("already replaced") ? 409 : 500;
      return fail(msg, code);
    }
  } else {
    doc = await insertDocument({
      clientId: client.id,
      filename: stored,
      originalFilename: file.name,
      storagePath,
      fileSizeBytes: file.size,
      mimeType: mime,
      category: category as DocumentCategory,
      month,
      year,
    });
  }

  await insertNotification({
    clientId: client.id,
    type: oldDoc ? "replacement" : "upload",
    title: oldDoc ? "Document replaced" : "Document uploaded",
    message: oldDoc
      ? `${file.name} replaces ${oldDoc.original_filename}.`
      : `${file.name} is pending review.`,
  });

  try {
    const adminEmail = process.env.RESEND_REPLY_TO ?? "satish@quad4consulting.com";
    await emailUploadNotification({
      to: adminEmail,
      clientName: client.business_name,
      count: 1,
      monthLabel: `${monthName(month)} ${year}`,
      reviewUrl: `https://admin.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "quad4consulting.com"}/queue?clientId=${client.id}`,
    });
  } catch (err) {
    console.warn("upload notification email failed", err);
  }

  return ok({ documentId: doc.id });
}
