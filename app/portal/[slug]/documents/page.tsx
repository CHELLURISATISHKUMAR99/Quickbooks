import { getClientBySlug, listDocuments } from "@/lib/supabase/queries";
import { DocumentList } from "@/components/portal/DocumentList";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  params,
}: {
  params: { slug: string };
}) {
  const client = await getClientBySlug(params.slug);
  if (!client) notFound();
  const docs = await listDocuments({ clientId: client.id });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My documents</h1>
        <p className="text-sm text-neutral-500">
          {docs.length} document{docs.length === 1 ? "" : "s"} on file
        </p>
      </div>
      <DocumentList docs={docs} />
    </div>
  );
}
