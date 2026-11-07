import { z } from "zod";

/**
 * Codes are no longer user input (owner request, 2026-11): the server derives
 * one from the strategy name (see `code.ts`) and keeps it unique per user.
 */

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #22c55e")
  .transform((color) => color.toLowerCase());

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const strategyId = z.uuid("Invalid strategy id");

export const styleSchema = z.enum(["scalp", "day", "swing", "position"]);
export type StyleValue = z.infer<typeof styleSchema>;

export const createStrategySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  color: hexColorSchema.optional().or(z.literal("")),
  description: optionalText(400),
  /** While a trade is open and auto-classification is impossible (§9). */
  defaultStyle: styleSchema.optional().or(z.literal("")),
});

export const updateStrategySchema = createStrategySchema.extend({
  strategyId,
});

export const archiveStrategySchema = z.object({
  strategyId,
  archived: z.boolean(),
});

/**
 * Per-account default strategy (owner request, 2026-11): new trades on the
 * account get it when magic map and comment both miss. `strategyId: null`
 * clears the default.
 */
export const setDefaultStrategySchema = z.object({
  accountId: z.uuid("Invalid account id"),
  strategyId: strategyId.nullable(),
});

/** MT5 magic numbers are int32 — 0 is valid (EA-less / manual trades). */
export const magicSchema = z
  .number()
  .int()
  .min(0)
  .max(2_147_483_647, "Magic must fit a 32-bit integer");

export const setMagicMappingSchema = z.object({
  accountId: z.uuid("Invalid account id"),
  magic: magicSchema,
  strategyId,
});

export const removeMagicMappingSchema = z.object({
  accountId: z.uuid("Invalid account id"),
  magic: magicSchema,
});

/** Task 09 hook — manual style override (§9: `style_source='manual'`). */
export const setTradeStyleSchema = z.object({
  tradeId: z.uuid("Invalid trade id"),
  style: styleSchema,
});

export type CreateStrategyInput = z.infer<typeof createStrategySchema>;
export type UpdateStrategyInput = z.infer<typeof updateStrategySchema>;
