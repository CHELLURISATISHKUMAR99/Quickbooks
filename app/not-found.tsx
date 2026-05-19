import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="text-center">
        <div className="q4-logo mx-auto mb-4">Q4</div>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-sm text-neutral-500 mb-4">
          The page or portal you’re looking for doesn’t exist.
        </p>
        <Link href="/" className="text-brand hover:underline text-sm">
          Back to home
        </Link>
      </div>
    </div>
  );
}
