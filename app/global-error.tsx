"use client";

import { useEffect } from "react";

// Catches errors thrown in the root layout itself (where app/error.tsx cannot
// reach). Replaces the entire document, so it ships its own <html>/<body> and
// uses inline styles — globals.css is not guaranteed to be loaded here.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The full stack is emitted server-side by Next.js; log here too so the
    // digest is never the only signal we have.
    console.error("[global-error]", error.digest, error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
          color: "#171717",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: "#185FA5",
              color: "#fff",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
            }}
          >
            Q4
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#525252", margin: "0 0 1.5rem" }}>
            The application hit an unexpected error. This is usually temporary —
            please try again in a moment.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#185FA5",
              color: "#fff",
              border: "none",
              padding: "0.75rem 1.5rem",
              borderRadius: 6,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#a3a3a3" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
