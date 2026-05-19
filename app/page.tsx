import Link from "next/link";
import { COMPANY_NAME } from "@/lib/utils/constants";

export default function MarketingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="q4-logo">Q4</div>
            <span className="font-semibold text-lg">{COMPANY_NAME}</span>
          </div>
          <Link
            href="/sign-in"
            className="text-sm font-medium text-brand hover:underline"
          >
            Sign in
          </Link>
        </div>
      </header>
      <section className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Bookkeeping, organized.
          </h1>
          <p className="text-lg text-neutral-600 mb-8">
            Upload documents, see your dashboard, and let us handle the books.
            Built for small US businesses.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/sign-in"
              className="inline-block bg-brand text-white px-6 py-3 rounded-md font-medium hover:opacity-90"
            >
              Sign in to your portal
            </Link>
            <div className="text-sm text-neutral-500">
              Admin? Go to <Link href="/admin" className="text-brand hover:underline">/admin</Link>
            </div>
          </div>
        </div>
      </section>
      <footer className="border-t border-neutral-200 bg-white text-xs text-neutral-500 py-4 text-center">
        Secured by {COMPANY_NAME}
      </footer>
    </main>
  );
}
