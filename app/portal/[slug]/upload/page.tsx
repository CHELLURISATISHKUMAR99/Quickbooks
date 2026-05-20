import { DocumentUpload } from "@/components/portal/DocumentUpload";

export default function UploadPage({ params }: { params: { slug: string } }) {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload documents</h1>
        <p className="text-sm text-neutral-500">
          Choose a category, tag the month, and drop your files. Satish will review and approve.
        </p>
      </div>
      <DocumentUpload slug={params.slug} />
    </div>
  );
}
