"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  value: string;
  /** Label while idle; defaults to "Copy". */
  label?: string;
  size?: "sm" | "default" | "icon";
  variant?: "outline" | "secondary" | "ghost" | "default";
}

/** Clipboard helper used by the one-time ingest-key reveal (spec §5.3). */
export function CopyButton({
  value,
  label = "Copy",
  size = "sm",
  variant = "outline",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={() => void copy()}
      aria-live="polite"
    >
      {copied ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}
