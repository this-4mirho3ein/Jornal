"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

/**
 * Last-resort boundary — when even the root layout throws, this is the only
 * thing that can render, so it owns the full <html>/<body> document.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] global error", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }} role="alert">
          <AlertTriangle
            style={{ width: 32, height: 32, margin: "0 auto 0.5rem", opacity: 0.7 }}
            aria-hidden="true"
          />
          <p style={{ fontWeight: 500 }}>The journal hit an unexpected error</p>
          <p style={{ opacity: 0.7, marginTop: "0.25rem" }}>
            The whole page failed to render. Retrying reloads the app.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: "0.375rem 0.875rem",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ opacity: 0.5, marginTop: "0.75rem", fontSize: 12 }}>
              error digest: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
