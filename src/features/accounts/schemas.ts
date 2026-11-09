import { z } from "zod";

import { TRADE_STYLE_VALUES } from "@/lib/trade-style";

const accountId = z.uuid("Invalid account id");

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

/** One-time-bind support for task 05's ingest path (schema-level only here). */
export const bindLoginFirstUseSchema = z.object({
  accountId,
  login: z.number().int().positive().safe(),
  server: optionalText(120),
  broker: optionalText(120),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Za-z]{3}$/, "3-letter currency code")
    .transform((c) => c.toUpperCase())
    .optional(),
});

export const accountDefaultStyleSchema = z.enum(TRADE_STYLE_VALUES);

export const createAccountSchema = z.object({
  /** Optional until the first bind; ingest then defaults it to `Login <login>`. */
  displayName: z.string().trim().max(80).optional(),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Za-z]{3}$/, "3-letter currency code")
    .transform((c) => c.toUpperCase())
    .optional(),
  isDemo: z.boolean().optional(),
  server: optionalText(120),
  broker: optionalText(120),
  login: z.number().int().positive().safe().optional(),
  /** Account-level style: every auto-style trade in this account gets it
   *  (owner request, 2026-11). Omitted/undefined = §9 holding-time auto. */
  defaultStyle: accountDefaultStyleSchema.optional(),
});

export const setAccountDefaultStyleSchema = z.object({
  accountId,
  /** null clears the override → §9 holding-time auto behavior. */
  defaultStyle: accountDefaultStyleSchema.nullable(),
});

export const renameAccountSchema = z.object({
  accountId,
  displayName: z.string().trim().min(1, "Name is required").max(80),
});

export const rotateKeySchema = z.object({ accountId });

export const archiveAccountSchema = z.object({ accountId, archived: z.boolean() });

/** IANA zone validated against the runtime ICU database. */
export const updateTimezoneSchema = z.object({
  accountId,
  timezone: z
    .string()
    .trim()
    .min(1)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone"),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type SetAccountDefaultStyleInput = z.infer<typeof setAccountDefaultStyleSchema>;
export type RenameAccountInput = z.infer<typeof renameAccountSchema>;
export type RotateKeyInput = z.infer<typeof rotateKeySchema>;
export type ArchiveAccountInput = z.infer<typeof archiveAccountSchema>;
export type UpdateTimezoneInput = z.infer<typeof updateTimezoneSchema>;
export type BindLoginFirstUseInput = z.infer<typeof bindLoginFirstUseSchema>;
