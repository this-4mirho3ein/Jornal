"use client";

import { Check, Loader2, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateTradeJournal } from "@/features/trades/journal-actions";
import { renderJournalNote } from "@/lib/journal-markdown";
import { cn } from "@/lib/utils";

const STYLES = ["scalp", "day", "swing", "position"] as const;
const EMOTIONS = [
  "confident",
  "neutral",
  "uncertain",
  "fear",
  "greed",
  "fomo",
  "revenge",
] as const;

const STYLE_LABELS = {
  scalp: "Scalp",
  day: "Day",
  swing: "Swing",
  position: "Position",
} as const;
const EMOTION_LABELS = {
  confident: "Confident",
  neutral: "Neutral",
  uncertain: "Uncertain",
  fear: "Fear",
  greed: "Greed",
  fomo: "FOMO",
  revenge: "Revenge",
} as const;

export interface JournalInitial {
  strategyId: string | null;
  style: (typeof STYLES)[number] | null;
  styleSource: "auto" | "manual";
  rating: number | null;
  emotion: (typeof EMOTIONS)[number] | null;
  notes: string | null;
  setupTags: string[];
  mistakeTags: string[];
}

interface JournalValues {
  strategyId: string;
  style: string;
  rating: number;
  emotion: string;
  notes: string;
  setupTags: string[];
  mistakeTags: string[];
}

const PATCH_KEYS = [
  "strategyId",
  "style",
  "rating",
  "emotion",
  "notes",
  "setupTags",
  "mistakeTags",
] as const;

function toValues(initial: JournalInitial): JournalValues {
  return {
    strategyId: initial.strategyId ?? "",
    style: initial.style ?? "",
    rating: initial.rating ?? 0,
    emotion: initial.emotion ?? "",
    notes: initial.notes ?? "",
    setupTags: [...initial.setupTags],
    mistakeTags: [...initial.mistakeTags],
  };
}

interface StrategyOption {
  id: string;
  name: string;
  color: string | null;
}

interface JournalFormProps {
  tradeId: string;
  initial: JournalInitial;
  strategyOptions: StrategyOption[];
}

/**
 * §8.2 #4/#6 — journal editor with 800 ms debounced autosave. Values live in
 * plain local state so every control answers instantly (ratings, style,
 * tags); the debounced save flushes diffs and the footer shows the status.
 */
export function JournalForm({ tradeId, initial, strategyOptions }: JournalFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<JournalValues>(() => toValues(initial));
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [preview, setPreview] = useState(false);
  const [tagDraft, setTagDraft] = useState({ setup: "", mistake: "" });

  const valuesRef = useRef(values);
  const baselineRef = useRef<JournalValues>(toValues(initial));
  const pendingRef = useRef<Partial<JournalValues>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function change(patch: Partial<JournalValues>) {
    setValues((prev) => ({ ...prev, ...patch }));
    valuesRef.current = { ...valuesRef.current, ...patch };
    pendingRef.current = { ...pendingRef.current, ...patch };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), 800);
  }

  async function flush(): Promise<void> {
    const pending = pendingRef.current;
    pendingRef.current = {};
    const patch: Record<string, unknown> = { tradeId };
    for (const key of PATCH_KEYS) {
      const next = pending[key];
      if (next === undefined) continue;
      const before = baselineRef.current[key];
      if (JSON.stringify(next) === JSON.stringify(before)) continue;
      patch[key] = next;
    }
    if (Object.keys(patch).length === 1) {
      setStatus("idle");
      return;
    }
    setStatus("saving");
    const result = await updateTradeJournal(patch);
    if (!result.ok) {
      toast.error(result.error);
      setStatus("idle");
      return;
    }
    baselineRef.current = { ...baselineRef.current, ...pending };
    setStatus("saved");
    router.refresh();
  }

  // Flush anything still pending when the editor unmounts (page navigation).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (Object.keys(pendingRef.current).length > 0) void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addTag(kind: "setupTags" | "mistakeTags", raw: string) {
    const tag = raw.trim().slice(0, 40);
    if (!tag) return;
    const draftKey = kind === "setupTags" ? "setup" : "mistake";
    if (valuesRef.current[kind].includes(tag)) {
      setTagDraft((prev) => ({ ...prev, [draftKey]: "" }));
      return;
    }
    change({ [kind]: [...valuesRef.current[kind], tag] } as Partial<JournalValues>);
    setTagDraft((prev) => ({ ...prev, [draftKey]: "" }));
  }

  function removeTag(kind: "setupTags" | "mistakeTags", tag: string) {
    change({
      [kind]: valuesRef.current[kind].filter((t) => t !== tag),
    } as Partial<JournalValues>);
  }

  const note = renderJournalNote(values.notes);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Journal</CardTitle>
        <span
          className={cn(
            "flex items-center gap-1 text-xs",
            status === "saved"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {status === "saving" ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : status === "saved" ? (
            <Check className="size-3" aria-hidden="true" />
          ) : null}
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="journal-strategy">Strategy</FieldLabel>
            <Select
              value={values.strategyId}
              onValueChange={(strategyId) => change({ strategyId })}
            >
              <SelectTrigger id="journal-strategy" className="w-full">
                <SelectValue placeholder="No strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span className="text-muted-foreground">No strategy</span>
                </SelectItem>
                {strategyOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Rename or add strategies on the{" "}
              <a href="/strategies" className="underline underline-offset-2">
                Strategies page
              </a>
              .
            </p>
          </Field>
          <Field>
            <FieldLabel htmlFor="journal-style">Style</FieldLabel>
            <Select
              value={values.style}
              onValueChange={(style) => change({ style })}
            >
              <SelectTrigger id="journal-style" className="w-full">
                <SelectValue placeholder="Auto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span className="text-muted-foreground">Auto (re-classify)</span>
                </SelectItem>
                {STYLES.map((style) => (
                  <SelectItem key={style} value={style}>
                    {STYLE_LABELS[style]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {initial.styleSource === "manual"
                ? "Manual override"
                : "Auto — from hold time (§9)"}
            </p>
          </Field>
        </div>

        <Field>
          <FieldLabel>Rating</FieldLabel>
          <div className="flex items-center gap-1" role="group" aria-label="Trade rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
                aria-pressed={values.rating >= star}
                onClick={() => change({ rating: values.rating === star ? 0 : star })}
                className="rounded p-0.5"
              >
                <Star
                  className={cn(
                    "size-5 transition-colors",
                    values.rating >= star
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/50",
                  )}
                  aria-hidden="true"
                />
              </button>
            ))}
            {values.rating > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => change({ rating: 0 })}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="journal-emotion">Emotion</FieldLabel>
          <Select
            value={values.emotion}
            onValueChange={(emotion) => change({ emotion })}
          >
            <SelectTrigger id="journal-emotion" className="w-full">
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">
                <span className="text-muted-foreground">Not set</span>
              </SelectItem>
              {EMOTIONS.map((emotion) => (
                <SelectItem key={emotion} value={emotion}>
                  {EMOTION_LABELS[emotion]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {(["setupTags", "mistakeTags"] as const).map((kind) => {
          const label = kind === "setupTags" ? "Setup tags" : "Mistake tags";
          const key = kind === "setupTags" ? "setup" : "mistake";
          return (
            <Field key={kind}>
              <FieldLabel htmlFor={`journal-${key}`}>{label}</FieldLabel>
              <div className="flex flex-wrap items-center gap-1.5">
                {values[kind].map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove ${tag}`}
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => removeTag(kind, tag)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <Input
                  id={`journal-${key}`}
                  value={tagDraft[key]}
                  placeholder="Add tag + Enter"
                  className="h-7 w-36 text-xs"
                  onChange={(event) =>
                    setTagDraft((prev) => ({ ...prev, [key]: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTag(kind, tagDraft[key]);
                    }
                  }}
                />
              </div>
            </Field>
          );
        })}

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="journal-notes">Notes (Markdown)</FieldLabel>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground"
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? "Edit" : "Preview"}
            </Button>
          </div>
          {preview ? (
            <div
              className="min-h-24 rounded-lg border p-3 text-sm [&_a]:text-primary"
              // Rendered by the sanitizer in lib/journal-markdown (escapes HTML first)
              dangerouslySetInnerHTML={{ __html: note.html }}
            />
          ) : (
            <Textarea
              id="journal-notes"
              rows={6}
              placeholder="What did you see, plan, and feel? (Markdown supported)"
              value={values.notes}
              onChange={(event) => change({ notes: event.target.value })}
            />
          )}
          <p className="text-right text-xs text-muted-foreground">{note.length} chars</p>
        </Field>
      </CardContent>
    </Card>
  );
}
