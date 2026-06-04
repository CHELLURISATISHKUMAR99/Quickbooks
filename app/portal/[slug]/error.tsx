"use client";

import { useEffect } from "react";

// Portal-segment error boundary. Catches throws from portal pages (dashboard,
// documents, reports, etc.) — e.g. a Supabase query failing during a DB
// outage — and shows a portal-appropriate retry message instead of a 500
// wrapper. (Errors in the portal layout itself bubble up to app/error.tsx.)
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[portal/error]", error.digest, error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold mb-2">We can&apos;t load your portal right now</h1>
        <p className="text-neutral-600 mb-6">
          We couldn&apos;t reach your data. This is usually temporary — please
          try again in a moment. Your documents and account are safe.
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
