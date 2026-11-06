CREATE TYPE "public"."cash_op_type" AS ENUM('deposit', 'withdrawal', 'bonus', 'credit', 'correction');--> statement-breakpoint
CREATE TYPE "public"."deal_entry" AS ENUM('in', 'out', 'inout', 'out_by');--> statement-breakpoint
CREATE TYPE "public"."deal_reason" AS ENUM('client', 'mobile', 'web', 'expert', 'sl', 'tp', 'so', 'other');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "public"."emotion" AS ENUM('confident', 'neutral', 'uncertain', 'fear', 'greed', 'fomo', 'revenge');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('deal_open', 'deal_close', 'position_modify', 'cash_op', 'heartbeat', 'snapshot');--> statement-breakpoint
CREATE TYPE "public"."image_kind" AS ENUM('entry', 'exit', 'htf', 'other');--> statement-breakpoint
CREATE TYPE "public"."style_source" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."trade_style" AS ENUM('scalp', 'day', 'swing', 'position');--> statement-breakpoint
CREATE TABLE "balance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"balance" numeric(18, 2) NOT NULL,
	"equity" numeric(18, 2),
	"margin" numeric(18, 2),
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"deal_id" bigint,
	"amount" numeric(18, 2) NOT NULL,
	"type" "cash_op_type" NOT NULL,
	"comment" text,
	"time_utc" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_operations_account_deal_uq" UNIQUE("account_id","deal_id")
);
--> statement-breakpoint
CREATE TABLE "magic_strategy_map" (
	"account_id" uuid NOT NULL,
	"magic" integer NOT NULL,
	"strategy_id" uuid NOT NULL,
	CONSTRAINT "magic_strategy_map_uq" UNIQUE("account_id","magic")
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"color" text,
	"description" text,
	"default_style" "trade_style",
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "strategies_user_code_uq" UNIQUE("user_id","code")
);
--> statement-breakpoint
CREATE TABLE "trade_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"deal_id" bigint NOT NULL,
	"order_id" bigint,
	"entry" "deal_entry" NOT NULL,
	"price" numeric(18, 5),
	"volume" numeric(18, 2),
	"profit" numeric(18, 2),
	"commission" numeric(18, 2),
	"swap" numeric(18, 2),
	"fee" numeric(18, 2),
	"time_utc" timestamp with time zone NOT NULL,
	"reason" "deal_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trade_deals_account_deal_uq" UNIQUE("account_id","deal_id")
);
--> statement-breakpoint
CREATE TABLE "trade_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"type" "event_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trade_events_account_event_uq" UNIQUE("account_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "trade_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"blob_url" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"caption" text,
	"kind" "image_kind" DEFAULT 'other' NOT NULL,
	"width" integer,
	"height" integer,
	"size_bytes" integer,
	"blur_data_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"position_id" bigint NOT NULL,
	"symbol" text NOT NULL,
	"direction" "direction" NOT NULL,
	"status" "trade_status" DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"volume_opened" numeric(18, 2),
	"volume_closed" numeric(18, 2),
	"avg_entry_price" numeric(18, 5),
	"avg_exit_price" numeric(18, 5),
	"sl" numeric(18, 5),
	"tp" numeric(18, 5),
	"initial_sl" numeric(18, 5),
	"initial_tp" numeric(18, 5),
	"gross_profit" numeric(18, 2),
	"commission" numeric(18, 2),
	"swap" numeric(18, 2),
	"fee" numeric(18, 2),
	"net_profit" numeric(18, 2),
	"balance_at_open" numeric(18, 2),
	"balance_at_close" numeric(18, 2),
	"risk_amount" numeric(18, 2),
	"r_multiple" numeric(18, 4),
	"pips_or_points" numeric(18, 5),
	"duration_seconds" integer,
	"strategy_id" uuid,
	"style" "trade_style",
	"style_source" "style_source" DEFAULT 'auto' NOT NULL,
	"mt5_comment" text,
	"mt5_magic" integer,
	"notes" text,
	"rating" integer,
	"emotion" "emotion",
	"setup_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"mistake_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"close_reason" "deal_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trades_account_position_uq" UNIQUE("account_id","position_id")
);
--> statement-breakpoint
CREATE TABLE "trading_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"login" bigint,
	"server" text,
	"broker" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"ingest_key_hash" text NOT NULL,
	"ingest_key_prefix" text NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_balance" numeric(18, 2),
	"last_equity" numeric(18, 2),
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trading_accounts_user_login_server_uq" UNIQUE("user_id","login","server")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_operations" ADD CONSTRAINT "cash_operations_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_strategy_map" ADD CONSTRAINT "magic_strategy_map_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_strategy_map" ADD CONSTRAINT "magic_strategy_map_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_deals" ADD CONSTRAINT "trade_deals_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_deals" ADD CONSTRAINT "trade_deals_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_events" ADD CONSTRAINT "trade_events_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_images" ADD CONSTRAINT "trade_images_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_account_id_trading_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD CONSTRAINT "trading_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "balance_snapshots_account_time_idx" ON "balance_snapshots" USING btree ("account_id","recorded_at");--> statement-breakpoint
CREATE INDEX "cash_operations_account_time_idx" ON "cash_operations" USING btree ("account_id","time_utc");--> statement-breakpoint
CREATE INDEX "trade_deals_trade_idx" ON "trade_deals" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "trade_events_received_idx" ON "trade_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "trade_images_trade_idx" ON "trade_images" USING btree ("trade_id","sort_order");--> statement-breakpoint
CREATE INDEX "trades_account_opened_idx" ON "trades" USING btree ("account_id","opened_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "trades_account_status_idx" ON "trades" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "trades_account_symbol_idx" ON "trades" USING btree ("account_id","symbol");--> statement-breakpoint
CREATE INDEX "trades_account_strategy_idx" ON "trades" USING btree ("account_id","strategy_id");--> statement-breakpoint
CREATE INDEX "trades_account_style_idx" ON "trades" USING btree ("account_id","style");--> statement-breakpoint
CREATE INDEX "trades_account_closed_idx" ON "trades" USING btree ("account_id","closed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "trades_setup_tags_gin" ON "trades" USING gin ("setup_tags");--> statement-breakpoint
CREATE INDEX "trades_mistake_tags_gin" ON "trades" USING gin ("mistake_tags");--> statement-breakpoint
CREATE INDEX "trading_accounts_key_hash_idx" ON "trading_accounts" USING btree ("ingest_key_hash");