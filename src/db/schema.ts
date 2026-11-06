import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums (spec §4.3)                                                   */
/* ------------------------------------------------------------------ */

export const directionEnum = pgEnum("direction", ["buy", "sell"]);
export const tradeStatusEnum = pgEnum("trade_status", ["open", "closed"]);
export const tradeStyleEnum = pgEnum("trade_style", [
  "scalp",
  "day",
  "swing",
  "position",
]);
export const styleSourceEnum = pgEnum("style_source", ["auto", "manual"]);
export const dealEntryEnum = pgEnum("deal_entry", ["in", "out", "inout", "out_by"]);
export const dealReasonEnum = pgEnum("deal_reason", [
  "client",
  "mobile",
  "web",
  "expert",
  "sl",
  "tp",
  "so",
  "other",
]);
export const imageKindEnum = pgEnum("image_kind", ["entry", "exit", "htf", "other"]);
export const cashOpTypeEnum = pgEnum("cash_op_type", [
  "deposit",
  "withdrawal",
  "bonus",
  "credit",
  "correction",
]);
export const emotionEnum = pgEnum("emotion", [
  "confident",
  "neutral",
  "uncertain",
  "fear",
  "greed",
  "fomo",
  "revenge",
]);
export const eventTypeEnum = pgEnum("event_type", [
  "deal_open",
  "deal_close",
  "position_modify",
  "cash_op",
  "heartbeat",
  "snapshot",
]);

/* ------------------------------------------------------------------ */
/* Auth (Better Auth 1.7.18, spec §15.2)                               */
/* Field names below MUST stay alias-compatible with Better Auth's     */
/* core schemas (user/session/account/verification). Table names are   */
/* mapped in src/lib/auth/server.ts via the drizzle adapter schema map. */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/**
 * Better Auth's OAuth/credential `account` model, renamed to avoid any
 * future clash with the domain's trading-account concept (spec §4.3).
 */
export const accountsAuth = pgTable(
  "accounts_auth",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("accounts_auth_provider_account_uq").on(t.providerId, t.accountId),
    index("accounts_auth_user_id_idx").on(t.userId),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

/* ------------------------------------------------------------------ */
/* trading_accounts (spec §4.3)                                        */
/* ------------------------------------------------------------------ */

export const tradingAccounts = pgTable(
  "trading_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    login: bigint("login", { mode: "number" }),
    server: text("server"),
    broker: text("broker"),
    currency: text("currency").notNull().default("USD"),
    isDemo: boolean("is_demo").notNull().default(false),
    /** SHA-256 of the ingest key — the raw key is never stored. */
    ingestKeyHash: text("ingest_key_hash").notNull(),
    ingestKeyPrefix: text("ingest_key_prefix").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastBalance: numeric("last_balance", { precision: 18, scale: 2 }),
    lastEquity: numeric("last_equity", { precision: 18, scale: 2 }),
    timezone: text("timezone").notNull().default("UTC"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("trading_accounts_user_login_server_uq").on(t.userId, t.login, t.server),
    index("trading_accounts_key_hash_idx").on(t.ingestKeyHash),
  ],
);

/* ------------------------------------------------------------------ */
/* strategies + magic mapping                                          */
/* ------------------------------------------------------------------ */

export const strategies = pgTable(
  "strategies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Short unique code used in MT5 comments, e.g. `S:ICT-OB` (spec §6.1). */
    code: text("code").notNull(),
    color: text("color"),
    description: text("description"),
    defaultStyle: tradeStyleEnum("default_style"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique("strategies_user_code_uq").on(t.userId, t.code)],
);

export const magicStrategyMap = pgTable(
  "magic_strategy_map",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => tradingAccounts.id, { onDelete: "cascade" }),
    magic: integer("magic").notNull(),
    strategyId: uuid("strategy_id")
      .notNull()
      .references(() => strategies.id, { onDelete: "cascade" }),
  },
  (t) => [unique("magic_strategy_map_uq").on(t.accountId, t.magic)],
);

/* ------------------------------------------------------------------ */
/* trades — one row per MT5 position (spec §4.3)                       */
/* ------------------------------------------------------------------ */

export const trades = pgTable(
  "trades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => tradingAccounts.id, { onDelete: "cascade" }),
    positionId: bigint("position_id", { mode: "number" }).notNull(),
    symbol: text("symbol").notNull(),
    direction: directionEnum("direction").notNull(),
    status: tradeStatusEnum("status").notNull().default("open"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    volumeOpened: numeric("volume_opened", { precision: 18, scale: 2 }),
    volumeClosed: numeric("volume_closed", { precision: 18, scale: 2 }),
    avgEntryPrice: numeric("avg_entry_price", { precision: 18, scale: 5 }),
    avgExitPrice: numeric("avg_exit_price", { precision: 18, scale: 5 }),
    sl: numeric("sl", { precision: 18, scale: 5 }),
    tp: numeric("tp", { precision: 18, scale: 5 }),
    /** First SL ever seen for the position — never overwritten (spec §4.1). */
    initialSl: numeric("initial_sl", { precision: 18, scale: 5 }),
    initialTp: numeric("initial_tp", { precision: 18, scale: 5 }),
    grossProfit: numeric("gross_profit", { precision: 18, scale: 2 }),
    commission: numeric("commission", { precision: 18, scale: 2 }),
    swap: numeric("swap", { precision: 18, scale: 2 }),
    fee: numeric("fee", { precision: 18, scale: 2 }),
    netProfit: numeric("net_profit", { precision: 18, scale: 2 }),
    balanceAtOpen: numeric("balance_at_open", { precision: 18, scale: 2 }),
    balanceAtClose: numeric("balance_at_close", { precision: 18, scale: 2 }),
    /** |entry − initial_sl| × tick math — only when tick values are known. */
    riskAmount: numeric("risk_amount", { precision: 18, scale: 2 }),
    rMultiple: numeric("r_multiple", { precision: 18, scale: 4 }),
    pipsOrPoints: numeric("pips_or_points", { precision: 18, scale: 5 }),
    durationSeconds: integer("duration_seconds"),
    strategyId: uuid("strategy_id").references(() => strategies.id, {
      onDelete: "set null",
    }),
    style: tradeStyleEnum("style"),
    styleSource: styleSourceEnum("style_source").notNull().default("auto"),
    mt5Comment: text("mt5_comment"),
    mt5Magic: integer("mt5_magic"),
    notes: text("notes"),
    rating: integer("rating"),
    emotion: emotionEnum("emotion"),
    setupTags: text("setup_tags")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    mistakeTags: text("mistake_tags")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    closeReason: dealReasonEnum("close_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("trades_account_position_uq").on(t.accountId, t.positionId),
    index("trades_account_opened_idx").on(t.accountId, t.openedAt.desc()),
    index("trades_account_status_idx").on(t.accountId, t.status),
    index("trades_account_symbol_idx").on(t.accountId, t.symbol),
    index("trades_account_strategy_idx").on(t.accountId, t.strategyId),
    index("trades_account_style_idx").on(t.accountId, t.style),
    index("trades_account_closed_idx").on(t.accountId, t.closedAt.desc()),
    // Tag filtering (spec §11) — GIN indexes on the tag arrays.
    index("trades_setup_tags_gin").using("gin", t.setupTags),
    index("trades_mistake_tags_gin").using("gin", t.mistakeTags),
  ],
);

/* ------------------------------------------------------------------ */
/* trade_deals — every MT5 deal (aggregates recompute from these)      */
/* ------------------------------------------------------------------ */

export const tradeDeals = pgTable(
  "trade_deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tradeId: uuid("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => tradingAccounts.id, { onDelete: "cascade" }),
    dealId: bigint("deal_id", { mode: "number" }).notNull(),
    orderId: bigint("order_id", { mode: "number" }),
    entry: dealEntryEnum("entry").notNull(),
    price: numeric("price", { precision: 18, scale: 5 }),
    volume: numeric("volume", { precision: 18, scale: 2 }),
    profit: numeric("profit", { precision: 18, scale: 2 }),
    commission: numeric("commission", { precision: 18, scale: 2 }),
    swap: numeric("swap", { precision: 18, scale: 2 }),
    fee: numeric("fee", { precision: 18, scale: 2 }),
    timeUtc: timestamp("time_utc", { withTimezone: true }).notNull(),
    reason: dealReasonEnum("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("trade_deals_account_deal_uq").on(t.accountId, t.dealId),
    index("trade_deals_trade_idx").on(t.tradeId),
  ],
);

/* ------------------------------------------------------------------ */
/* trade_events — append-only audit + idempotency log (pruned by cron) */
/* ------------------------------------------------------------------ */

export const tradeEvents = pgTable(
  "trade_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => tradingAccounts.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    type: eventTypeEnum("type").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("trade_events_account_event_uq").on(t.accountId, t.eventId),
    index("trade_events_received_idx").on(t.receivedAt),
  ],
);

/* ------------------------------------------------------------------ */
/* trade_images                                                        */
/* ------------------------------------------------------------------ */

export const tradeImages = pgTable(
  "trade_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tradeId: uuid("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    blobUrl: text("blob_url").notNull(),
    blobPathname: text("blob_pathname").notNull(),
    caption: text("caption"),
    kind: imageKindEnum("kind").notNull().default("other"),
    width: integer("width"),
    height: integer("height"),
    sizeBytes: integer("size_bytes"),
    blurDataUrl: text("blur_data_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("trade_images_trade_idx").on(t.tradeId, t.sortOrder)],
);

/* ------------------------------------------------------------------ */
/* balance_snapshots — equity curve (throttled in the ingest path)     */
/* ------------------------------------------------------------------ */

export const balanceSnapshots = pgTable(
  "balance_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => tradingAccounts.id, { onDelete: "cascade" }),
    balance: numeric("balance", { precision: 18, scale: 2 }).notNull(),
    equity: numeric("equity", { precision: 18, scale: 2 }),
    margin: numeric("margin", { precision: 18, scale: 2 }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("balance_snapshots_account_time_idx").on(t.accountId, t.recordedAt)],
);

/* ------------------------------------------------------------------ */
/* cash_operations — deposits/withdrawals, never part of trade PnL     */
/* ------------------------------------------------------------------ */

export const cashOperations = pgTable(
  "cash_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => tradingAccounts.id, { onDelete: "cascade" }),
    dealId: bigint("deal_id", { mode: "number" }),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    type: cashOpTypeEnum("type").notNull(),
    comment: text("comment"),
    timeUtc: timestamp("time_utc", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("cash_operations_account_deal_uq").on(t.accountId, t.dealId),
    index("cash_operations_account_time_idx").on(t.accountId, t.timeUtc),
  ],
);

/* ------------------------------------------------------------------ */
/* Inferred types                                                      */
/* ------------------------------------------------------------------ */

export type User = typeof users.$inferSelect;
export type AuthSession = typeof sessions.$inferSelect;
export type AuthAccount = typeof accountsAuth.$inferSelect;
export type AuthVerification = typeof verifications.$inferSelect;
export type TradingAccount = typeof tradingAccounts.$inferSelect;
export type NewTradingAccount = typeof tradingAccounts.$inferInsert;
export type Strategy = typeof strategies.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
export type TradeDeal = typeof tradeDeals.$inferSelect;
export type NewTradeDeal = typeof tradeDeals.$inferInsert;
export type TradeEvent = typeof tradeEvents.$inferSelect;
export type TradeImage = typeof tradeImages.$inferSelect;
export type BalanceSnapshot = typeof balanceSnapshots.$inferSelect;
export type CashOperation = typeof cashOperations.$inferSelect;
export type Direction = (typeof directionEnum.enumValues)[number];
export type TradeStatus = (typeof tradeStatusEnum.enumValues)[number];
export type TradeStyle = (typeof tradeStyleEnum.enumValues)[number];
export type DealEntry = (typeof dealEntryEnum.enumValues)[number];
export type DealReason = (typeof dealReasonEnum.enumValues)[number];
export type Emotion = (typeof emotionEnum.enumValues)[number];
