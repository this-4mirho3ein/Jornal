"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArchiveRestore, Plus } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { CopyButton } from "@/components/shared/copy-button";
import { IngestKeyContent } from "@/app/(app)/accounts/ingest-key-reveal";
import { styleLabels, TRADE_STYLE_VALUES } from "@/lib/trade-style";
import {
  createAccountWithKey,
  type CreateAccountData,
} from "@/features/accounts/actions";

/** Client-side mirror of createAccountSchema — transforms stay server-side. */
const formSchema = z.object({
  displayName: z.string().trim().max(80).optional().or(z.literal("")),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "3-letter code, e.g. USD")
    .optional()
    .or(z.literal("")),
  login: z
    .string()
    .trim()
    .regex(/^\d{1,16}$/, "Digits only")
    .optional()
    .or(z.literal("")),
  server: z.string().trim().max(120).optional().or(z.literal("")),
  broker: z.string().trim().max(120).optional().or(z.literal("")),
  isDemo: z.boolean(),
  /** "" = Auto (§9 holding time); otherwise the account-wide style. */
  defaultStyle: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_VALUES: FormValues = {
  displayName: "",
  currency: "",
  login: "",
  server: "",
  broker: "",
  isDemo: false,
  defaultStyle: "auto",
};

/** "New account" → captures details, then shows the one-time ingest key. */
export function CreateAccountDialog({
  triggerLabel = "New account",
}: {
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState<CreateAccountData | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_VALUES,
  });
  const defaultStyleValue = watch("defaultStyle");

  async function onSubmit(values: FormValues) {
    const result = await createAccountWithKey({
      defaultStyle:
        values.defaultStyle === "auto" ? undefined : values.defaultStyle || undefined,
      displayName: values.displayName || undefined,
      currency: values.currency ? values.currency.toUpperCase() : undefined,
      login: values.login ? Number(values.login) : undefined,
      server: values.server || undefined,
      broker: values.broker || undefined,
      isDemo: values.isDemo,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    // Show the one-time key and STAY OPEN: the page refresh must wait until
    // the user closes the reveal — refreshing immediately swaps this
    // Suspense-mounted subtree and tears the modal (with the key) down while
    // the user is still copying.
    setReveal(result.data);
  }

  function handleOpenChange(next: boolean) {
    if (!next && reveal) {
      // Manual close after a successful create — the fresh row appears now.
      router.refresh();
    }
    setOpen(next);
    if (!next) {
      reset(EMPTY_VALUES);
      setReveal(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby="create-account-description"
        // While the one-time key is on screen, an outside click must not
        // dismiss the dialog — dismissal stays manual (X / "I saved it"/Esc).
        onInteractOutside={reveal ? (event) => event.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle>Add MT5 account</DialogTitle>
          <DialogDescription id="create-account-description">
            Login and server attach automatically on the EA&apos;s first handshake —
            everything here is optional except the demo/live switch.
          </DialogDescription>
        </DialogHeader>
        {reveal ? (
          reveal.reactivated ? (
            // Re-add of a removed account: the original row comes back (its
            // trades and binding untouched) and the key is ROTATED — the raw
            // key can never be shown twice, so a fresh one is issued here and
            // the previous key retires immediately (the EA must be updated).
            <div className="flex flex-col gap-3">
              <p className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">
                <ArchiveRestore className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  <strong>“{reveal.account.displayName}” is back.</strong> Its trades
                  and MT5 binding are exactly as they were. Because a key can only be
                  shown once, a <strong>fresh key</strong> was issued below and the
                  previous one stopped working — update your EA (
                  <code className="font-mono">journal_key.txt</code> or the InpApiKey
                  input) with the new key.
                </span>
              </p>
              <IngestKeyContent
                result={{ key: reveal.key ?? "", keyPrefix: reveal.keyPrefix }}
              />
              <div className="flex justify-end gap-2">
                <CopyButton value={reveal.key ?? ""} label="Copy key" size="default" />
                <Button onClick={() => handleOpenChange(false)}>I saved it</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Fresh creation — key is always present here (null only on the
                  reactivation branch above). */}
              <IngestKeyContent
                result={{ key: reveal.key ?? "", keyPrefix: reveal.keyPrefix }}
              />
              <div className="flex justify-end gap-2">
                <CopyButton value={reveal.key ?? ""} label="Copy key" size="default" />
                <Button onClick={() => handleOpenChange(false)}>I saved it</Button>
              </div>
            </div>
          )
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            noValidate
          >
            <FieldGroup>
              <Field data-invalid={!!errors.displayName || undefined}>
                <FieldLabel htmlFor="displayName">Display name</FieldLabel>
                <Input
                  id="displayName"
                  placeholder="FTMO Challenge 100k"
                  aria-invalid={!!errors.displayName}
                  {...register("displayName")}
                />
                {errors.displayName ? (
                  <FieldError>{errors.displayName.message}</FieldError>
                ) : null}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={!!errors.login || undefined}>
                  <FieldLabel htmlFor="login">MT5 login</FieldLabel>
                  <Input
                    id="login"
                    inputMode="numeric"
                    placeholder="51234567"
                    aria-invalid={!!errors.login}
                    {...register("login")}
                  />
                  {errors.login ? (
                    <FieldError>{errors.login.message}</FieldError>
                  ) : null}
                </Field>
                <Field data-invalid={!!errors.currency || undefined}>
                  <FieldLabel htmlFor="currency">Currency</FieldLabel>
                  <Input
                    id="currency"
                    placeholder="USD"
                    maxLength={3}
                    aria-invalid={!!errors.currency}
                    {...register("currency")}
                  />
                  {errors.currency ? (
                    <FieldError>{errors.currency.message}</FieldError>
                  ) : null}
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={!!errors.broker || undefined}>
                  <FieldLabel htmlFor="broker">Broker</FieldLabel>
                  <Input
                    id="broker"
                    placeholder="IC Markets"
                    aria-invalid={!!errors.broker}
                    {...register("broker")}
                  />
                  {errors.broker ? (
                    <FieldError>{errors.broker.message}</FieldError>
                  ) : null}
                </Field>
                <Field data-invalid={!!errors.server || undefined}>
                  <FieldLabel htmlFor="server">Server</FieldLabel>
                  <Input
                    id="server"
                    placeholder="ICMarketsSC-Demo"
                    aria-invalid={!!errors.server}
                    {...register("server")}
                  />
                  {errors.server ? (
                    <FieldError>{errors.server.message}</FieldError>
                  ) : null}
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="defaultStyle">Trading style</FieldLabel>
                <Select
                  value={defaultStyleValue}
                  onValueChange={(value) =>
                    setValue("defaultStyle", value, { shouldDirty: true })
                  }
                >
                  <SelectTrigger id="defaultStyle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">
                      Auto — classified by holding time (§9)
                    </SelectItem>
                    {TRADE_STYLE_VALUES.map((style) => (
                      <SelectItem key={style} value={style}>
                        {styleLabels[style]} — every trade in this account
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Applies to every trade in this account (manual overrides on single
                  trades still win); changeable any time from the ⋯ menu.
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor="isDemo">Demo account</FieldLabel>
                <div className="flex items-center gap-2">
                  <Switch id="isDemo" {...register("isDemo")} />
                  <span className="text-xs text-muted-foreground">
                    Mark as DEMO to keep it out of live statistics
                  </span>
                </div>
              </Field>
            </FieldGroup>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create account"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
