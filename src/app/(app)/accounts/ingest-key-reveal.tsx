"use client";

import { KeyRound, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CopyButton } from "@/components/shared/copy-button";

export interface IngestKeyResult {
  key: string;
  keyPrefix: string;
}

/**
 * The one screen where a raw ingest key is visible (spec §5.3).
 * Only the SHA-256 hash + prefix are stored server-side — after this screen
 * closes the key cannot be recovered, only rotated.
 */
export function IngestKeyContent({ result }: { result: IngestKeyResult }) {
  return (
    <>
      <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        This key is shown <strong>only once</strong>. The journal stores just its
        SHA-256 hash — losing it means rotating the key again.
      </p>
      <code
        className="block overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm select-all"
        data-testid="ingest-key"
      >
        {result.key}
      </code>
      <p className="text-xs text-muted-foreground">
        Next: connect MetaTrader 5 —{" "}
        <Link
          href="/guide"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          follow the setup guide
        </Link>{" "}
        (download the EA, allow WebRequest, paste this key).
      </p>
    </>
  );
}

interface IngestKeyRevealProps {
  result: IngestKeyResult;
  title: string;
  description: string;
  onClose: () => void;
}

/** Standalone reveal dialog — used by the rotate flow on the accounts page. */
export function IngestKeyReveal({
  result,
  title,
  description,
  onClose,
}: IngestKeyRevealProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby="ingest-key-description"
        // Show-once secret: an outside click must not throw the key away —
        // dismissal stays manual (X / "I saved it" / Esc).
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" aria-hidden="true" />
            {title}
          </DialogTitle>
          <DialogDescription id="ingest-key-description">
            {description}
          </DialogDescription>
        </DialogHeader>
        <IngestKeyContent result={result} />
        <DialogFooter>
          <CopyButton value={result.key} label="Copy key" size="default" />
          <Button onClick={onClose}>I saved it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
