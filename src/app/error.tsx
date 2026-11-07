"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";

/**
 * Route-segment error boundary (spec §14): renders inside the current chrome
 * with a retry; the digest goes to the console for correlation with logs.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] segment error", error);
  }, [error]);

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
      <ErrorState
        icon={AlertTriangle}
        title="Something went wrong"
        description="An unexpected error occurred while loading this view. Retrying usually fixes it — if it persists, check the server logs."
        action={
          <Button onClick={reset} size="sm">
            Try again
          </Button>
        }
      />
      {error.digest ? (
        <p className="text-center font-mono text-xs text-muted-foreground">
          error digest: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
