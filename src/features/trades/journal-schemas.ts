import { z } from "zod";

const TRADE_STYLES = ["scalp", "day", "swing", "position"] as const;
const TRADE_EMOTIONS = [
  "confident",
  "neutral",
  "uncertain",
  "fear",
  "greed",
  "fomo",
  "revenge",
] as const;

export type JournalStyle = (typeof TRADE_STYLES)[number];
export type JournalEmotion = (typeof TRADE_EMOTIONS)[number];

const tagArray = z
  .array(z.string().trim().min(1).max(40))
  .max(30)
  .transform((tags) => [...new Set(tags)]);

/**
 * Journal-fields patch (§8.2 #6 autosave): every key is optional — absence
 * means untouched. Clearing uses sentinel values ("" / 0) because the
 * debounced autosave always includes the key it is flushing.
 */
export const journalPatchSchema = z.object({
  tradeId: z.uuid(),
  strategyId: z.union([z.uuid(), z.literal("")]).optional(),
  style: z.union([z.enum(TRADE_STYLES), z.literal("")]).optional(),
  rating: z
    .union([z.number().int().min(1).max(5), z.literal(0)])
    .optional(),
  emotion: z.union([z.enum(TRADE_EMOTIONS), z.literal("")]).optional(),
  notes: z.string().max(20_000).optional(),
  setupTags: tagArray.optional(),
  mistakeTags: tagArray.optional(),
});

export type JournalPatch = z.infer<typeof journalPatchSchema>;
