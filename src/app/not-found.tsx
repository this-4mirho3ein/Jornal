import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";

/** Root 404 (spec §14) — unknown URL anywhere outside a segment boundary. */
export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-md">
        <EmptyState
          icon={SearchX}
          title="Page not found"
          description="This URL doesn't match anything in the journal — it may have been moved or mistyped."
          action={
            <Button asChild size="sm">
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
