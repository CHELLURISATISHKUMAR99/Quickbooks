"use client";

import { useEffect } from "react";

// Root segment error boundary. Catches throws from any nested layout/page
// below the root layout — including app/portal/[slug]/layout.tsx, which is
// where the Supabase "fetch failed / ENOTFOUND" outage rendered only a bare
// digest. The root layout still renders, so brand classes from globals.css
// are available here.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Next.js emits the full server-side stack; log here so the digest is not
    // the only thing we ever see.
    console.error("[app/error]", error.digest, error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-neutral-50">
      <div className="max-w-md text-center">
        <div className="q4-logo mx-auto mb-6">Q4</div>
        <h1 className="text-2xl font-semibold mb-2">We can&apos;t reach the service</h1>
        <p className="text-neutral-600 mb-6">
          Something went wrong loading this page. This is usually a temporary
          connection issue — please try again in a moment.
        </p>
        <button
          onClick={reset}
          className="inline-block bg-brand text-white px-6 py-3 rounded-md font-medium hover:opacity-90"
        >
          Try again
        </button>
        {error.digest ? (
          <p className="mt-6 text-xs text-neutral-400">Reference: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
