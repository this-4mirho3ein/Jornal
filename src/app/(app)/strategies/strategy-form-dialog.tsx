"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createStrategy, updateStrategy } from "@/features/strategies/actions";
import { cn } from "@/lib/utils";

/** Client-side mirror of create/updateStrategySchema — transforms stay server-side. */
const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  color: z.string(),
  defaultStyle: z.string(),
  description: z.string().trim().max(400).optional(),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_VALUES: FormValues = {
  name: "",
  color: "",
  defaultStyle: "",
  description: "",
};

const SWATCHES = [
  "#22c55e",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#64748b",
] as const;

const STYLE_OPTIONS = [
  { value: "scalp", label: "Scalp" },
  { value: "day", label: "Day" },
  { value: "swing", label: "Swing" },
  { value: "position", label: "Position" },
] as const;

/** Shape passed for edit mode — dates stay outside (the form never shows them). */
export interface StrategyFormValues {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  defaultStyle: string | null;
}

interface StrategyFormDialogProps {
  /** Renders a trigger button when set (create mode). */
  triggerLabel?: string;
  /** Edit mode: prefill from this strategy. */
  strategy?: StrategyFormValues | null;
  /** Controlled open (edit mode); leave undefined for internal state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function StrategyFormDialog({
  triggerLabel,
  strategy,
  open: controlledOpen,
  onOpenChange,
}: StrategyFormDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const defaults: FormValues = strategy
    ? {
        name: strategy.name,
        color: strategy.color ?? "",
        defaultStyle: strategy.defaultStyle ?? "",
        description: strategy.description ?? "",
      }
    : EMPTY_VALUES;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  // Re-prefill on every open (including switching edit targets) — done in the
  // open-change callback, not an effect, so no cascading render.
  function handleOpenChange(next: boolean) {
    if (next) reset(defaults);
    setOpen(next);
  }

  const color = watch("color");
  const defaultStyle = watch("defaultStyle");

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      color: values.color || undefined,
      defaultStyle: values.defaultStyle || undefined,
      description: values.description || undefined,
    };
    const result = strategy
      ? await updateStrategy({ ...payload, strategyId: strategy.id })
      : await createStrategy(payload);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(strategy ? "Strategy updated." : "Strategy created.");
    setOpen(false);
    router.refresh();
  }

  const isEdit = !!strategy;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {triggerLabel ? (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="size-4" aria-hidden="true" />
            {triggerLabel}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent aria-describedby="strategy-form-description">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit strategy" : "New strategy"}</DialogTitle>
          <DialogDescription id="strategy-form-description">
            A short code for MT5 order comments (<code className="font-mono text-xs">S:…</code>)
            is derived from the name automatically — trades are tagged by magic
            mapping, comment code, or the account&apos;s default strategy.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <FieldGroup>
            <Field data-invalid={!!errors.name || undefined}>
              <FieldLabel htmlFor="strategy-name">Name</FieldLabel>
              <Input
                id="strategy-name"
                placeholder="ICT Silver Bullet"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              {errors.name ? (
                <FieldError>{errors.name.message}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel>Color</FieldLabel>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Strategy color">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-7 text-xs text-muted-foreground",
                    color === "" && "ring-2 ring-ring/40",
                  )}
                  onClick={() => setValue("color", "", { shouldDirty: true })}
                >
                  None
                </Button>
                {SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Color ${swatch}`}
                    aria-pressed={color === swatch}
                    onClick={() => setValue("color", swatch, { shouldDirty: true })}
                    className={cn(
                      "size-6 rounded-full border border-black/10 transition-transform",
                      color === swatch && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                    )}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="strategy-style">Default style (open trades)</FieldLabel>
              <Select
                value={defaultStyle}
                onValueChange={(value) =>
                  setValue("defaultStyle", value, { shouldDirty: true })
                }
              >
                <SelectTrigger id="strategy-style" className="w-full">
                  <SelectValue placeholder="Auto (Day)" />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used while a trade is open; re-classified from hold time on close
                (scalp &lt; 15 min, day, swing, position &gt; 2 weeks).
              </p>
            </Field>
            <Field data-invalid={!!errors.description || undefined}>
              <FieldLabel htmlFor="strategy-description">Description</FieldLabel>
              <Textarea
                id="strategy-description"
                placeholder="What is the setup, confluence, typical session?"
                rows={3}
                aria-invalid={!!errors.description}
                {...register("description")}
              />
              {errors.description ? (
                <FieldError>{errors.description.message}</FieldError>
              ) : null}
            </Field>
          </FieldGroup>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create strategy"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
