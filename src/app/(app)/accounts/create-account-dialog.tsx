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
import { Switch } from "@/components/ui/switch";
import { CopyButton } from "@/components/shared/copy-button";
import {
  IngestKeyContent,
  type IngestKeyResult,
} from "@/app/(app)/accounts/ingest-key-reveal";
import { createAccountWithKey } from "@/features/accounts/actions";

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
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_VALUES: FormValues = {
  displayName: "",
  currency: "",
  login: "",
  server: "",
  broker: "",
  isDemo: false,
};

/** "New account" → captures details, then shows the one-time ingest key. */
export function CreateAccountDialog({
  triggerLabel = "New account",
}: {
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState<IngestKeyResult | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_VALUES,
  });

  async function onSubmit(values: FormValues) {
    const result = await createAccountWithKey({
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
    setReveal(result.data);
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
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
      <DialogContent aria-describedby="create-account-description">
        <DialogHeader>
          <DialogTitle>Add MT5 account</DialogTitle>
          <DialogDescription id="create-account-description">
            Login and server attach automatically on the EA&apos;s first handshake —
            everything here is optional except the demo/live switch.
          </DialogDescription>
        </DialogHeader>
        {reveal ? (
          <div className="flex flex-col gap-3">
            <IngestKeyContent result={reveal} />
            <div className="flex justify-end gap-2">
              <CopyButton value={reveal.key} label="Copy key" size="default" />
              <Button onClick={() => handleOpenChange(false)}>I saved it</Button>
            </div>
          </div>
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
