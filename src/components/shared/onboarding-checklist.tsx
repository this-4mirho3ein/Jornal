"use client";

import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OnboardingProgress } from "@/features/dashboard/queries";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "tj:onboarding-dismissed";

const listeners = new Set<() => void>();

/**
 * Dismissal lives in localStorage as an external store: `useSyncExternalStore`
 * hydrates with the server snapshot (checklist visible) and re-reads after
 * mount, so there is no setState-in-effect cascade and no hydration mismatch.
 */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function isDismissed(): boolean {
  return window.localStorage.getItem(DISMISS_KEY) === "1";
}

function getServerSnapshot(): boolean {
  return false;
}

function setDismissedFlag(dismissed: boolean): void {
  if (dismissed) window.localStorage.setItem(DISMISS_KEY, "1");
  else window.localStorage.removeItem(DISMISS_KEY);
  for (const listener of listeners) listener();
}

/**
 * First-run checklist (spec §12.4): 1. create account → 2. ingest key →
 * 3. install the EA → 4. first trade received, derived server-side from the
 * DB. Shown on the dashboard until the first trade lands; hiding persists in
 * localStorage and falls back to the plain empty state.
 */
export function OnboardingChecklist({ progress }: { progress: OnboardingProgress }) {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, getServerSnapshot);
  const toggleDismissed = useCallback(
    () => setDismissedFlag(!dismissed),
    [dismissed],
  );

  const steps = [
    {
      label: "Create an account",
      done: progress.hasAccount,
      href: "/accounts",
      hint: "Add your MT5 account on the Accounts page.",
    },
    {
      label: "Grab the ingest key",
      done: progress.hasKey,
      href: "/accounts",
      hint: "Every account gets one automatically — copy it from Accounts.",
    },
    {
      label: "Install the EA",
      done: progress.hasHeartbeat,
      href: "/accounts",
      hint: "Attach JournalSync.mq5 to one MT5 chart with that key — setup steps are on the Accounts page.",
    },
    {
      label: "First trade received",
      done: progress.hasTrades,
      href: "/trades",
      hint: "Once the EA is live, deals stream in here in real time.",
    },
  ];

  if (dismissed) {
    return (
      <EmptyState
        title="Nothing to show yet"
        description="Finish EA setup to pull in your trades — the checklist stays hidden until you bring it back."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={toggleDismissed}
          >
            Show setup checklist
          </Button>
        }
      />
    );
  }

  const doneCount = steps.filter((step) => step.done).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-sm">Getting started</CardTitle>
          <CardDescription>
            {doneCount === steps.length
              ? "All set — the journal will fill itself in."
              : `${doneCount} of ${steps.length} done — trades, equity and metrics appear automatically.`}
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={toggleDismissed}
        >
          Hide
        </Button>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col">
          {steps.map((step, index) => (
            <li key={step.label}>
              <Link
                href={step.href}
                className={cn(
                  "flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50",
                  index > 0 && "mt-0.5",
                )}
              >
                {step.done ? (
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-profit"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm",
                      step.done
                        ? "text-muted-foreground line-through decoration-border"
                        : "font-medium",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{step.hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
