/**
 * Ingest wire schema (spec §4.2) — the contract between the EA and the API.
 *
 * MT5/JSON may deliver numerics as strings, so everything numeric is coerced.
 * Money/price values stay numeric strings beyond this boundary (they are
 * re-serialized with decimal.js in the reducer, never float arithmetic).
 *
 * Shape rules per event type (§4.2 comments):
 *   deal_open / deal_close → position + deal required
 *   position_modify        → position required, deal forbidden
 *   cash_op                → deal required (amount = deal.profit), position optional
 *   heartbeat / snapshot   → position and deal forbidden
 */
import { z } from "zod";

export const INGEST_EVENT_TYPES = [
  "deal_open",
  "deal_close",
  "position_modify",
  "cash_op",
  "heartbeat",
  "snapshot",
] as const;

export type IngestEventType = (typeof INGEST_EVENT_TYPES)[number];

const num = z.coerce.number().finite();
const epochSec = num.int().nonnegative();

export const accountWireSchema = z.object({
  login: num.int().positive(),
  server: z.string().trim().min(1).max(120),
  company: z.string().trim().max(160).optional(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((s) => s.toUpperCase()),
  leverage: num.int().positive().max(10_000).optional(),
  balance: num,
  equity: num,
  margin: num,
  freeMargin: num,
  marginLevel: num,
  isDemo: z.coerce.boolean(),
});

export const positionWireSchema = z.object({
  positionId: num.int().positive(),
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((s) => s.toUpperCase()),
  direction: z.enum(["buy", "sell"]),
  magic: num.int().min(0).max(2_147_483_647).optional(),
  comment: z
    .string()
    .max(200)
    .optional()
    .transform((s) => (s === undefined ? undefined : s.trim())),
  /**
   * Current open volume after this event (§4.2). 0 is valid — the EA emits
   * `volume: 0` when the position is already fully closed (spec §6
   * BuildClosedPositionJson). Aggregation is deal-driven, so this field is
   * informational only; it must never be required positive.
   */
  volume: num.min(0),
  /** 0 = none (§4.2) — reducer maps it to null. */
  sl: num.min(0),
  /** 0 = none (§4.2) — reducer maps it to null. */
  tp: num.min(0),
  /** §10 (recommended now): enables exact risk_amount / r_multiple. */
  tickValue: num.min(0).optional(),
  tickSize: num.positive().optional(),
});

export const dealWireSchema = z.object({
  dealId: num.int().positive(),
  orderId: num.int().positive().optional(),
  entry: z.enum(["in", "out", "inout", "out_by"]),
  price: num.min(0),
  volume: num.min(0),
  /** For cash_op this is the deposited/withdrawn amount (sign carries it). */
  profit: num,
  commission: num,
  swap: num,
  fee: num,
  timeUtc: epochSec,
  reason: z.enum(["client", "mobile", "web", "expert", "sl", "tp", "so", "other"]).optional(),
});

export const ingestEventSchema = z
  .object({
    /** Versioned contract (§19) — anything but v1 is rejected with 422. */
    schemaVersion: z.literal(1),
    eventId: z.string().trim().min(1).max(200),
    type: z.enum(INGEST_EVENT_TYPES),
    sentAtUtc: epochSec,
    account: accountWireSchema,
    position: positionWireSchema.optional(),
    deal: dealWireSchema.optional(),
  })
  .superRefine((event, ctx) => {
    const { type, position, deal } = event;
    const needsPosition = type === "deal_open" || type === "deal_close" || type === "position_modify";
    const needsDeal = type === "deal_open" || type === "deal_close" || type === "cash_op";

    if (needsPosition && !position) {
      ctx.addIssue({ code: "custom", path: ["position"], message: `position is required for ${type}` });
    }
    if (needsDeal && !deal) {
      ctx.addIssue({ code: "custom", path: ["deal"], message: `deal is required for ${type}` });
    }
    if (type === "heartbeat" || type === "snapshot") {
      if (position) {
        ctx.addIssue({ code: "custom", path: ["position"], message: `position is forbidden for ${type}` });
      }
      if (deal) {
        ctx.addIssue({ code: "custom", path: ["deal"], message: `deal is forbidden for ${type}` });
      }
    }
    if (type === "position_modify" && deal) {
      ctx.addIssue({ code: "custom", path: ["deal"], message: "deal is forbidden for position_modify" });
    }
  });

export type IngestEvent = z.infer<typeof ingestEventSchema>;
export type IngestAccountWire = z.infer<typeof accountWireSchema>;
export type IngestPositionWire = z.infer<typeof positionWireSchema>;
export type IngestDealWire = z.infer<typeof dealWireSchema>;

/** Both direction unions line up across wire and DB enums. */
export type DirectionValue = "buy" | "sell";
export type DealEntryValue = "in" | "out" | "inout" | "out_by";
export type DealReasonValue = "client" | "mobile" | "web" | "expert" | "sl" | "tp" | "so" | "other";

/**
 * `0 = none` on the wire → null in the database (spec §4.2).
 */
export function priceOrNull(value: number): string | null {
  return value > 0 ? value.toFixed(5) : null;
}

/** Epoch seconds on the wire → timestamptz Date in the DB. */
export function epochToDate(seconds: number): Date {
  return new Date(seconds * 1000);
}
