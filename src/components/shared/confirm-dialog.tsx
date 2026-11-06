"use client";

import { useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  /** Uncontrolled: render this to open. Omit when driven by `open`. */
  trigger?: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Controlled open state (e.g. opened from a DropdownMenuItem). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Runs on confirm; the dialog closes after the promise settles. */
  onConfirm: () => Promise<void>;
  /** Hide the built-in close-on-success (parent drives closing). */
  keepOpenOnConfirm?: boolean;
}

/**
 * Confirmation gate for breaking actions (rotate key, archive, …).
 * Works uncontrolled (trigger prop) or controlled (open/onOpenChange),
 * so DropdownMenu items can open it without nesting Radix trees.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  open: controlledOpen,
  onOpenChange,
  onConfirm,
  keepOpenOnConfirm = false,
}: ConfirmDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  function setOpen(next: boolean) {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      if (!keepOpenOnConfirm) setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => setOpen(next)}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
            disabled={busy}
            className={
              destructive
                ? "bg-destructive text-white hover:bg-destructive/90"
                : undefined
            }
          >
            {busy ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
