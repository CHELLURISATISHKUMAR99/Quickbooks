import Link from "next/link";
import { notFound } from "next/navigation";
import {
  documentFileExists,
  getClientBySlug,
  getDocumentById,
} from "@/lib/supabase/queries";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  DOCUMENT_CATEGORIES,
  monthName,
} from "@/lib/utils/constants";
import { formatBytes, formatDate, timeAgo } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const INLINE_PREVIEWABLE = ["application/pdf", "image/jpeg", "image/png"];

export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string; id: string };
  searchParams: { from?: string };
}) {
  const client = await getClientBySlug(params.slug);
  if (!client) notFound();

  const doc = await getDocumentById(params.id);
  // Tenant guard: 404 (not 403) on cross-tenant access so we don't leak
  // existence of other clients' documents.
  if (!doc || doc.client_id !== client.id) notFound();

  const replacement =
    doc.replaced_by_id ? await getDocumentById(doc.replaced_by_id) : null;
  const fileExists = await documentFileExists(doc.storage_path);

  const category = DOCUMENT_CATEGORIES.find((c) => c.value === doc.category);
  const previewUrl = `/api/documents/${doc.id}/preview`;
  const isImage = doc.mime_type.startsWith("image/");
  const isPdf = doc.mime_type === "application/pdf";
  const canInline =
    fileExists && INLINE_PREVIEWABLE.includes(doc.mime_type);

  const backHref = sanitizeBackHref(searchParams.from);

  const replaceQs = new URLSearchParams({
    category: doc.category,
    month: String(doc.month),
    year: String(doc.year),
    replaces: doc.id,
  }).toString();
  const replaceHref = `/upload?${replaceQs}`;
  const canReplace = doc.status !== "replaced";
  const replacePrimary = doc.status === "rejected";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Link
            href={backHref}
            className="text-sm text-brand hover:underline inline-flex items-center gap-1"
          >
            ← Back to documents
          </Link>
          <h1 className="text-2xl font-bold break-all">
            {doc.original_filename}
          </h1>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <StatusBadge status={doc.status} />
            <span>·</span>
            <span>Uploaded {timeAgo(doc.uploaded_at)}</span>
          </div>
        </div>
        {canReplace && (
          <Link
            href={replaceHref}
            className={
              replacePrimary
                ? "bg-brand text-white px-5 py-2 rounded-md text-sm font-medium hover:opacity-90"
                : "border border-neutral-300 bg-white text-neutral-800 px-5 py-2 rounded-md text-sm font-medium hover:bg-neutral-50"
            }
          >
            Replace document
          </Link>
        )}
      </div>

      {replacement && (
        <div className="bg-neutral-100 border border-neutral-200 text-neutral-700 rounded-md px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
          <span>
            Replaced by{" "}
            <Link
              href={`/documents/${replacement.id}`}
              className="font-medium text-brand hover:underline"
            >
              {replacement.original_filename}
            </Link>{" "}
            on {formatDate(replacement.uploaded_at)}.
          </span>
        </div>
      )}

      {doc.status === "rejected" && doc.rejection_reason && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md px-4 py-3 text-sm">
          <div className="font-medium mb-0.5">Rejected</div>
          <div>{doc.rejection_reason}</div>
          {doc.reviewed_by && doc.reviewed_at && (
            <div className="text-xs text-red-700 mt-1">
              by {doc.reviewed_by} · {formatDate(doc.reviewed_at)}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 bg-neutral-50 text-sm">
            <span className="font-medium">Preview</span>
            {fileExists && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline"
              >
                Open in new tab
              </a>
            )}
          </div>
          {!fileExists ? (
            <div className="p-10 text-center text-sm text-neutral-600">
              <div className="font-medium text-neutral-800 mb-1">
                File unavailable
              </div>
              <p>
                We couldn&apos;t find the underlying file. Please contact your
                bookkeeper.
              </p>
            </div>
          ) : canInline ? (
            isPdf ? (
              <iframe
                src={previewUrl}
                title={doc.original_filename}
                className="w-full h-[70vh] bg-neutral-100"
              />
            ) : isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={doc.original_filename}
                className="w-full max-h-[70vh] object-contain bg-neutral-100"
              />
            ) : null
          ) : (
            <div className="p-10 text-center text-sm text-neutral-600">
              <p className="mb-3">
                Preview not supported for this file type.
              </p>
              <a
                href={previewUrl}
                className="inline-block bg-brand text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
              >
                Download
              </a>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="bg-white border border-neutral-200 rounded-lg p-5">
            <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-neutral-500">
              Details
            </h2>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Category</dt>
                <dd className="text-right">
                  {category?.label ?? doc.category}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Period</dt>
                <dd className="text-right">
                  {monthName(doc.month)} {doc.year}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">File size</dt>
                <dd className="text-right">
                  {formatBytes(doc.file_size_bytes)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Type</dt>
                <dd className="text-right">{doc.mime_type}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Uploaded</dt>
                <dd className="text-right">{formatDate(doc.uploaded_at)}</dd>
              </div>
              {doc.reviewed_at && (
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-500">Reviewed</dt>
                  <dd className="text-right">{formatDate(doc.reviewed_at)}</dd>
                </div>
              )}
              {doc.reviewed_by && (
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-500">Reviewed by</dt>
                  <dd className="text-right">{doc.reviewed_by}</dd>
                </div>
              )}
            </dl>
          </div>

          {fileExists && (
            <a
              href={previewUrl}
              className="block text-center border border-neutral-300 bg-white text-neutral-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-neutral-50"
              download={doc.original_filename}
            >
              Download
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}

// Only accept internal /documents paths so the back link can't be
// hijacked into an open-redirect.
function sanitizeBackHref(from: string | undefined): string {
  if (!from) return "/documents";
  if (!from.startsWith("/documents")) return "/documents";
  return from;
}
