# TRADING JOURNAL — FULL ENGINEERING SPECIFICATION

> **Audience:** an AI coding model (GLM). Read this entire file before writing any code.
> **Role you must adopt:** Senior Software Engineer + Senior UI/UX Designer.
> **Goal:** Build a real-time, professional, mobile-first trading journal web app (Next.js on Vercel) that automatically receives every trade event from MetaTrader 5 (MT5), stores it, and lets the owner analyze, filter, tag by strategy, and attach screenshots.

---

## 0. HOW TO WORK (RULES FOR THE CODING MODEL)

1. **Follow the phases in Section 18 in order.** Finish and verify each phase before starting the next.
2. **Never guess library versions.** Run `npm view <pkg> version` (or use `@latest`) and install the newest stable release. If an API in this document differs from the installed version's docs, **the installed version's docs win**. Adapt, and leave a short comment.
3. **TypeScript strict mode. No `any`.** Validate every external input with Zod.
4. **No code duplication (DRY).** Shared logic goes to `lib/`, shared UI goes to `components/`. If you copy-paste something twice, extract it.
5. **Server Components by default.** Use `"use client"` only for interactive leaves.
6. **No secrets in the client.** Environment variables are validated at boot (Section 15).
7. **Money math is never done with JS floats for storage.** Store prices/profits in Postgres `numeric`, and handle them as strings or `decimal.js` / `big.js` where arithmetic is needed.
8. **Everything idempotent.** The MT5 sender may retry; the API must never create duplicate trades.
9. **Every phase ends with:** `pnpm typecheck && pnpm lint && pnpm build` passing.
10. Write small, named, tested functions. Add unit tests for all pure logic (R-multiple, scalp/swing classifier, PnL aggregation, payload reducer).

---

## 1. PRODUCT SUMMARY

| #   | Requirement                                                                                      | Where covered         |
| --- | ------------------------------------------------------------------------------------------------ | --------------------- |
| 1   | Reliable, real-time connection from MT5 → website, sending entry, SL, TP, balance, P/L, etc.     | Sections 3, 4, 5, 6   |
| 2   | Professional journal UI, strategy names, scalp/swing classification, per-trade screenshot upload | Sections 8, 9, 10, 11 |
| 3   | Deploy to Vercel with a free database                                                            | Sections 2, 7, 16     |
| 4   | Rename/manage multiple accounts and know which data belongs to which account                     | Sections 7, 8         |
| 5   | Nice filters, subtle animations, professional look                                               | Sections 11, 12       |
| 6   | Use a React/Next UI kit, no duplication                                                          | Sections 2, 12        |
| 7   | SEO + performance + maintainability, latest versions                                             | Sections 13, 14, 15   |
| 8   | Fully mobile responsive                                                                          | Section 12            |

---

## 2. TECH STACK (use the latest stable of each)

| Concern                | Choice                                                                                                                          | Why                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Framework              | **Next.js (latest stable, App Router, Turbopack)** — as of my knowledge this is Next.js 16; verify with `npm view next version` | Server Components, Route Handlers, caching, Vercel-native                                                      |
| Language               | **TypeScript (strict)**                                                                                                         | Safety                                                                                                         |
| Package manager        | **pnpm**                                                                                                                        | Fast, disk efficient                                                                                           |
| Styling                | **Tailwind CSS v4** (CSS-first config)                                                                                          | Standard, small output                                                                                         |
| UI kit                 | **shadcn/ui** (Radix primitives, copy-in components) + **lucide-react** icons                                                   | Best DX, fully customizable, accessible                                                                        |
| Tables                 | **TanStack Table v8**                                                                                                           | Server-side sort/filter/pagination                                                                             |
| Data fetching (client) | **TanStack Query**                                                                                                              | Polling/invalidations for live updates                                                                         |
| Charts                 | **shadcn Charts (Recharts)**                                                                                                    | Consistent with the UI kit                                                                                     |
| Forms                  | **react-hook-form + @hookform/resolvers + Zod**                                                                                 | Typed forms                                                                                                    |
| URL state (filters)    | **nuqs**                                                                                                                        | Type-safe, shareable filter URLs                                                                               |
| Database               | **Neon Postgres** (Vercel Marketplace integration, free tier)                                                                   | Free, serverless, Vercel-native. (The old "Vercel Postgres" product was migrated to Neon via the Marketplace.) |
| ORM                    | **Drizzle ORM + drizzle-kit** (`drizzle-orm/neon-http` or `neon-serverless`)                                                    | Light, typed, serverless-friendly                                                                              |
| Image storage          | **Vercel Blob** (free Hobby quota) with **client uploads**                                                                      | Keeps big files out of serverless function limits                                                              |
| Auth                   | **Better Auth** (email+password, single owner) — verify current docs. Alternative: Auth.js                                      | Protects the private journal                                                                                   |
| Realtime to browser    | **Pusher Channels (free tier)** _or_ **Ably free tier**, with **TanStack Query polling as fallback**                            | Vercel serverless cannot hold WebSocket servers                                                                |
| Rate limiting          | **Upstash Redis + @upstash/ratelimit** (free tier)                                                                              | Protect ingest endpoint                                                                                        |
| Date/time              | **date-fns** + **date-fns-tz** (or Temporal polyfill if stable)                                                                 | Timezone handling                                                                                              |
| Decimal math           | **decimal.js**                                                                                                                  | Prices/PnL                                                                                                     |
| Testing                | **Vitest** (+ Testing Library), **Playwright** for 1–2 e2e smoke tests                                                          |                                                                                                                |
| Lint/format            | **ESLint (Next config) + Prettier + prettier-plugin-tailwindcss**                                                               |                                                                                                                |
| Env validation         | **@t3-oss/env-nextjs + Zod**                                                                                                    | Fail fast                                                                                                      |
| Image compression      | **browser-image-compression**                                                                                                   | Smaller uploads                                                                                                |
| Monitoring             | **Vercel Analytics + Speed Insights** (free)                                                                                    | Perf visibility                                                                                                |

> **Next.js 16 notes (verify against installed docs):** `middleware.ts` is renamed to `proxy.ts`; Turbopack is the default bundler; Cache Components (`"use cache"`, `cacheComponents` in `next.config`) replace the old experimental PPR flag; `params` / `searchParams` / `cookies()` / `headers()` are **async** (must be `await`ed). React 19.x features (`use`, Actions, `useActionState`, `useOptimistic`) are available.

---

## 3. THE MT5 CONNECTION — READ THIS FIRST (CRITICAL)

### 3.1 The important truth about "MT5 on the web"

The **MetaTrader 5 Web Terminal (browser version) does NOT support Expert Advisors (EAs) or custom code.** Nothing can be installed in it, so it cannot push data to your site by itself.

There are three real ways to connect. **Primary = Option A.**

| Option                                                              | How                                                                                                                                                                                                                 | Pros                                                                                               | Cons                                                                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **A (PRIMARY, recommended): MQL5 Expert Advisor with `WebRequest`** | A small EA runs inside the **desktop MT5** (Windows, or Mac/Linux via Wine/CrossOver) on your PC **or a cheap Windows VPS**. It listens to trade events and POSTs JSON to `https://YOUR-APP.vercel.app/api/ingest`. | Free, truly real-time (event-driven), no passwords shared with 3rd parties, you control everything | MT5 desktop must be running (VPS solves this: MetaQuotes' built-in VPS service, or any cheap Windows VPS)              |
| **B: MetaApi cloud (metaapi.cloud)**                                | Give MetaApi your account login + **investor (read-only) password**; it streams trades via REST/WebSocket/webhooks. No EA needed.                                                                                   | Works even if you only use the web terminal / phone; no VPS                                        | Third party holds read-only credentials; free tier is limited; some broker servers unsupported; adds vendor dependency |
| **C: Python `MetaTrader5` package on a Windows machine**            | A script polls the terminal and posts to the API                                                                                                                                                                    | Flexible                                                                                           | Windows-only, needs terminal running, polling not event-driven                                                         |

**Implementation requirement:**

- Build the **ingest API (Section 5) so it is source-agnostic** (a normalized event schema). Option A's EA is provided in Section 6.
- Add a thin **adapter interface** `lib/ingest/adapters/*` so a MetaApi adapter (Option B) can be added later without touching the core.
- Tell the user in the README: _"If you only use the MT5 web terminal, either install MT5 desktop on a VPS with the EA (best), or use the MetaApi option."_

### 3.2 Why EA + WebRequest is the best approach

- `OnTradeTransaction()` fires **instantly** when a deal is executed, SL/TP modified, or a position opens/closes → true real-time.
- Reads exact data from the terminal: entry price, SL, TP, volume, commission, swap, profit, balance, equity, magic number, comment.
- Plain HTTPS POST to Vercel. No sockets needed.
- Works with **any broker**.

### 3.3 MT5 setup the user must do (put in README)

1. MT5 desktop → **Tools → Options → Expert Advisors**.
2. Tick **"Allow WebRequest for listed URL"** and add `https://YOUR-APP.vercel.app` (exact origin, no path, add the custom domain too if used).
3. Tick **"Allow algorithmic trading"**.
4. Copy `JournalSync.mq5` into `MQL5/Experts/`, compile in MetaEditor (F7).
5. Drag the EA onto **any one chart** (one EA instance per account is enough; it receives events for ALL symbols).
6. Set inputs: `InpApiUrl`, `InpApiKey` (created in the website's _Accounts_ page).
7. Keep the terminal running (VPS recommended).

---

## 4. DATA MODEL & EVENT MODEL

### 4.1 MT5 concepts the code MUST respect

- MT5 records **deals** (executions) and **positions**. A position has one or more **entry deals** (`DEAL_ENTRY_IN`), and one or more **exit deals** (`DEAL_ENTRY_OUT`, `DEAL_ENTRY_OUT_BY`, `DEAL_ENTRY_INOUT` for reversals). All share one `position_id` (`DEAL_POSITION_ID`).
- **A "trade" in the journal = one MT5 position** (identified by `account_id + position_id`).
- **Partial closes** produce multiple exit deals → the journal stores each deal in `trade_deals` and aggregates into `trades`.
- **Netting vs hedging accounts** behave differently; always key on `position_id`, never on symbol.
- **Initial SL/TP:** MT5 reports only the _current_ SL. The journal must store `initial_sl` = the **first SL ever seen** for that position (never overwritten). It is needed for R-multiple.
- **Time:** MT5 deal times are in **broker server time**. The EA must convert to **UTC epoch seconds** (see EA code). Store `timestamptz` in UTC; display in the user's chosen timezone.

### 4.2 Normalized event schema (the contract between EA and API)

```jsonc
// POST /api/ingest   (header: Authorization: Bearer <account ingest key>)
{
  "schemaVersion": 1,
  "eventId": "deal:123456789", // globally unique per account; used for idempotency
  "type": "deal_open | deal_close | position_modify | cash_op | heartbeat | snapshot",
  "sentAtUtc": 1767225600, // epoch seconds UTC
  "account": {
    "login": 12345678,
    "server": "ICMarkets-Demo",
    "company": "Raw Trading Ltd",
    "currency": "USD",
    "leverage": 500,
    "balance": 10234.55,
    "equity": 10310.1,
    "margin": 120.4,
    "freeMargin": 10189.7,
    "marginLevel": 8563.2,
    "isDemo": true,
  },
  "position": {
    // for deal_open / deal_close / position_modify
    "positionId": 987654321,
    "symbol": "XAUUSD",
    "direction": "buy | sell",
    "magic": 1001,
    "comment": "S:ICT-OB",
    "volume": 0.1, // current open volume after this event
    "sl": 2310.5, // 0 = none
    "tp": 2340.0, // 0 = none
  },
  "deal": {
    // for deal_open / deal_close / cash_op
    "dealId": 123456789,
    "orderId": 555,
    "entry": "in | out | inout | out_by",
    "price": 2321.35,
    "volume": 0.1,
    "profit": 42.1,
    "commission": -0.7,
    "swap": 0,
    "fee": 0,
    "timeUtc": 1767225590,
    "reason": "client | mobile | web | expert | sl | tp | so", // DEAL_REASON mapping
  },
}
```

### 4.3 Database schema (Drizzle, Postgres)

Implement in `db/schema.ts`. Use `numeric(18,5)` for prices and `numeric(18,2)` for money. Use `uuid` PKs (`defaultRandom()`), `timestamptz` everywhere, `createdAt/updatedAt`.

**Tables**

- `users` / `sessions` / `accounts_auth` → managed by Better Auth (follow its generated schema).
- `trading_accounts`
  - `id`, `user_id`, **`display_name`** (renameable, e.g. "Prop FTMO 100k"), `login` (bigint), `server`, `broker`, `currency`, `is_demo`, `ingest_key_hash` (sha256 of the key; **never store the key itself**), `ingest_key_prefix` (first 6 chars for UI), `last_seen_at`, `last_balance`, `last_equity`, `timezone`, `archived_at`.
  - Unique: `(user_id, login, server)`.
- `strategies`
  - `id`, `user_id`, `name`, `code` (short unique e.g. `ICT-OB`), `color`, `description`, `default_style` (`scalp|swing|day|position|null`), `archived_at`.
- `magic_strategy_map`
  - `account_id`, `magic` (int), `strategy_id` → auto-assign strategy by EA magic number.
- `trades`
  - `id`, `account_id`, `position_id` (bigint), `symbol`, `direction`, `status` (`open|closed`), `opened_at`, `closed_at`,
  - `volume_opened`, `volume_closed`, `avg_entry_price`, `avg_exit_price`, `sl`, `tp`, `initial_sl`, `initial_tp`,
  - `gross_profit`, `commission`, `swap`, `fee`, `net_profit`,
  - `balance_at_open`, `balance_at_close`, `risk_amount` (computed from initial SL), `r_multiple`, `pips_or_points`, `duration_seconds`,
  - `strategy_id` (nullable FK), `style` (`scalp|day|swing|position`), `style_source` (`auto|manual`), `mt5_comment`, `mt5_magic`,
  - `notes` (text), `rating` (1–5, nullable), `emotion` (nullable enum), `mistake_tags` (text[]), `setup_tags` (text[]),
  - `close_reason`, `created_at`, `updated_at`.
  - **Unique: `(account_id, position_id)`**.
  - **Indexes:** `(account_id, opened_at desc)`, `(account_id, status)`, `(account_id, symbol)`, `(account_id, strategy_id)`, `(account_id, style)`, `(account_id, closed_at desc)`. Add a GIN index on the tag arrays if tag filtering is used.
- `trade_deals`
  - `id`, `trade_id`, `account_id`, `deal_id` (bigint), `order_id`, `entry` enum, `price`, `volume`, `profit`, `commission`, `swap`, `fee`, `time_utc`, `reason`.
  - **Unique: `(account_id, deal_id)`**.
- `trade_events` (append-only audit/idempotency log)
  - `id`, `account_id`, `event_id` (text), `type`, `payload` (jsonb), `received_at`. **Unique: `(account_id, event_id)`**. Prune rows older than ~90 days with a cron.
- `trade_images`
  - `id`, `trade_id`, `blob_url`, `blob_pathname`, `caption`, `kind` (`entry|exit|htf|other`), `width`, `height`, `size_bytes`, `sort_order`, `created_at`.
- `balance_snapshots`
  - `id`, `account_id`, `balance`, `equity`, `margin`, `recorded_at`. Written on every event (throttled to max 1 per 30 s per account) and by heartbeat. Powers the equity curve.
- `cash_operations` (deposits/withdrawals/credits so they don't pollute trade PnL)
  - `id`, `account_id`, `deal_id`, `amount`, `type`, `comment`, `time_utc`.

---

## 5. INGEST API (the heart of the system)

**Route:** `app/api/ingest/route.ts` — `export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"`, `maxDuration` small (e.g. 15).

### 5.1 Request pipeline (in this exact order)

1. **Read raw body** (limit 64 KB; reject larger with 413).
2. **Auth:** `Authorization: Bearer <key>`. Hash with SHA-256, look up `trading_accounts.ingest_key_hash`. Use constant-time compare. Reject with 401 on failure (generic message).
3. **Rate-limit** per key (Upstash): e.g. 120 requests / minute, burst friendly. Return 429 with `Retry-After`.
4. **Zod-validate** against the schema in 4.2 (versioned; reject unknown `schemaVersion` with 422).
5. **Account binding check:** if the account row has no `login` yet → bind it (first-use claim) from `account.login/server`. If it has one and the payload's login differs → 403 (key used on the wrong account).
6. **Idempotency:** `INSERT INTO trade_events ... ON CONFLICT (account_id, event_id) DO NOTHING RETURNING id`. If nothing inserted → return `200 { duplicate: true }` immediately.
7. **Reduce the event into state** inside **one DB transaction** (`lib/ingest/reducer.ts`, a pure function + a thin DB layer):
   - `deal_open`: upsert `trades` by `(account_id, position_id)`; insert `trade_deals`; on first insert set `opened_at`, `initial_sl`, `initial_tp`, `balance_at_open`, `strategy_id` (via `magic_strategy_map` or by parsing comment `S:<code>`), `style` (auto-classify, Section 9).
   - `position_modify`: update `sl`, `tp` (never touch `initial_*` unless currently null/0).
   - `deal_close`: insert `trade_deals`; recompute aggregates from `trade_deals` (sum profit/commission/swap/fee, volume-weighted exit price); if remaining volume ≈ 0 → `status='closed'`, set `closed_at`, `balance_at_close`, `net_profit`, `r_multiple`, `duration_seconds`, `close_reason`.
   - `cash_op`: insert into `cash_operations`.
   - `heartbeat` / any event: update `trading_accounts.last_seen_at`, `last_balance`, `last_equity`; write `balance_snapshots` (throttled).
   - **Handle out-of-order events:** a `deal_close` may arrive before its `deal_open` (retry queue). If the trade row doesn't exist, create a stub trade and let the later `deal_open` fill the gaps. Aggregates are **always recomputed from `trade_deals`**, never incrementally mutated.
8. **Publish realtime notification** (Section 6.5) _after_ commit, fire-and-forget (don't fail the request if Pusher fails).
9. **Return** `200 { ok: true, tradeId }`. Return **2xx only when durably stored.** The EA deletes its queued item on 2xx; retries on 5xx/network failure; drops on 4xx (except 429).

### 5.2 Other API routes / Server Actions

Prefer **Server Actions** (with Zod + auth check) for UI mutations: rename account, create strategy, edit trade notes/tags/strategy/style, delete image, create ingest key.
Use **Route Handlers** only for: `/api/ingest`, `/api/blob/upload` (Vercel Blob client-upload token handler), `/api/cron/*`, `/api/health`.

### 5.3 Ingest key management

- Created in _Accounts → New account_. Show the key **once** (copy button), store only the hash + prefix. Provide "Rotate key" action.
- One key per account.

---

## 6. EXPERT ADVISOR (MQL5) — `JournalSync.mq5`

Requirements: event-driven, **persistent retry queue on disk** (so nothing is lost if the website or internet is down or MT5 restarts), heartbeat, optional history backfill, UTC conversion, JSON escaping.

> The code below is a complete, working skeleton. Compile in MetaEditor and fix any minor compiler warnings that appear on the user's build. Keep structure and behavior.

```mql5
//+------------------------------------------------------------------+
//| JournalSync.mq5 - Pushes MT5 trade events to the web journal     |
//+------------------------------------------------------------------+
#property copyright "Trading Journal"
#property version   "1.00"
#property strict

input string InpApiUrl        = "https://YOUR-APP.vercel.app/api/ingest";
input string InpApiKey        = "";      // Ingest key from the website
input int    InpHeartbeatSec  = 60;      // heartbeat + queue flush period
input int    InpTimeoutMs     = 8000;    // WebRequest timeout
input int    InpBackfillDays  = 0;       // >0: send closed deals of last N days once at start
input bool   InpVerbose       = false;

const string QUEUE_FILE = "journal_queue.jsonl";   // in MQL5/Files
datetime     g_lastHeartbeat = 0;
bool         g_flushing = false;

//------------------------------------------------------------------
int OnInit()
{
   if(StringLen(InpApiKey) < 10) { Alert("JournalSync: set InpApiKey"); return INIT_PARAMETERS_INCORRECT; }
   EventSetTimer(1);
   if(InpBackfillDays > 0) Backfill(InpBackfillDays);
   EnqueueEvent("hb:" + (string)TimeGMT(), "heartbeat", "", "");
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) { EventKillTimer(); }

//------------------------------------------------------------------
void OnTimer()
{
   FlushQueue();
   if(TimeGMT() - g_lastHeartbeat >= InpHeartbeatSec)
   {
      g_lastHeartbeat = TimeGMT();
      EnqueueEvent("hb:" + (string)((long)TimeGMT()), "heartbeat", "", "");
   }
}

//------------------------------------------------------------------
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
{
   // 1) A deal was added to history (open, close, balance op...)
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
   {
      ulong dealId = trans.deal;
      if(!HistoryDealSelect(dealId)) { HistorySelect(TimeCurrent() - 86400*3, TimeCurrent() + 60); if(!HistoryDealSelect(dealId)) return; }
      SendDeal(dealId);
      return;
   }
   // 2) SL/TP modified on an open position
   if(trans.type == TRADE_TRANSACTION_POSITION && trans.position > 0)
   {
      if(PositionSelectByTicket(trans.position))
      {
         string posJson = BuildPositionJson(trans.position);
         string id = "mod:" + (string)trans.position + ":" + DoubleToString(PositionGetDouble(POSITION_SL), 5) + ":" + DoubleToString(PositionGetDouble(POSITION_TP), 5);
         EnqueueEvent(id, "position_modify", posJson, "");
      }
   }
}

//------------------------------------------------------------------
void SendDeal(ulong dealId)
{
   long dtype = HistoryDealGetInteger(dealId, DEAL_TYPE);
   long entry = HistoryDealGetInteger(dealId, DEAL_ENTRY);

   // Non-trade operations: balance/credit/charge/correction/bonus...
   if(dtype != DEAL_TYPE_BUY && dtype != DEAL_TYPE_SELL)
   {
      EnqueueEvent("deal:" + (string)dealId, "cash_op", "", BuildDealJson(dealId));
      return;
   }
   ulong posId = (ulong)HistoryDealGetInteger(dealId, DEAL_POSITION_ID);
   string type = (entry == DEAL_ENTRY_IN) ? "deal_open" : "deal_close";

   string posJson;
   if(PositionSelectByTicket(posId)) posJson = BuildPositionJson(posId);
   else                              posJson = BuildClosedPositionJson(dealId, posId);

   EnqueueEvent("deal:" + (string)dealId, type, posJson, BuildDealJson(dealId));
}

//------------------------------------------------------------------
string BuildPositionJson(ulong posId)
{
   // requires PositionSelectByTicket(posId) to have succeeded
   long   ptype = PositionGetInteger(POSITION_TYPE);
   string s = "{";
   s += "\"positionId\":" + (string)posId;
   s += ",\"symbol\":\"" + JsonEsc(PositionGetString(POSITION_SYMBOL)) + "\"";
   s += ",\"direction\":\"" + (ptype == POSITION_TYPE_BUY ? "buy" : "sell") + "\"";
   s += ",\"magic\":" + (string)PositionGetInteger(POSITION_MAGIC);
   s += ",\"comment\":\"" + JsonEsc(PositionGetString(POSITION_COMMENT)) + "\"";
   s += ",\"volume\":" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2);
   s += ",\"sl\":" + DoubleToString(PositionGetDouble(POSITION_SL), 5);
   s += ",\"tp\":" + DoubleToString(PositionGetDouble(POSITION_TP), 5);
   s += "}";
   return s;
}

// Position already (fully) closed: rebuild from the deal itself
string BuildClosedPositionJson(ulong dealId, ulong posId)
{
   long dtype = HistoryDealGetInteger(dealId, DEAL_TYPE);
   // closing deal direction is opposite of the position direction
   string dir = (dtype == DEAL_TYPE_SELL) ? "buy" : "sell";
   double sl = HistoryDealGetDouble(dealId, DEAL_SL);
   double tp = HistoryDealGetDouble(dealId, DEAL_TP);
   string s = "{";
   s += "\"positionId\":" + (string)posId;
   s += ",\"symbol\":\"" + JsonEsc(HistoryDealGetString(dealId, DEAL_SYMBOL)) + "\"";
   s += ",\"direction\":\"" + dir + "\"";
   s += ",\"magic\":" + (string)HistoryDealGetInteger(dealId, DEAL_MAGIC);
   s += ",\"comment\":\"" + JsonEsc(HistoryDealGetString(dealId, DEAL_COMMENT)) + "\"";
   s += ",\"volume\":0";
   s += ",\"sl\":" + DoubleToString(sl, 5);
   s += ",\"tp\":" + DoubleToString(tp, 5);
   s += "}";
   return s;
}

string BuildDealJson(ulong dealId)
{
   long entry = HistoryDealGetInteger(dealId, DEAL_ENTRY);
   string e = "in";
   if(entry == DEAL_ENTRY_OUT) e = "out";
   else if(entry == DEAL_ENTRY_INOUT) e = "inout";
   else if(entry == DEAL_ENTRY_OUT_BY) e = "out_by";

   long reason = HistoryDealGetInteger(dealId, DEAL_REASON);
   string r = "other";
   if(reason == DEAL_REASON_SL) r = "sl";
   else if(reason == DEAL_REASON_TP) r = "tp";
   else if(reason == DEAL_REASON_SO) r = "so";
   else if(reason == DEAL_REASON_EXPERT) r = "expert";
   else if(reason == DEAL_REASON_CLIENT) r = "client";
   else if(reason == DEAL_REASON_MOBILE) r = "mobile";
   else if(reason == DEAL_REASON_WEB) r = "web";

   datetime tServer = (datetime)HistoryDealGetInteger(dealId, DEAL_TIME);
   long tUtc = (long)tServer - ServerOffsetSec();

   string s = "{";
   s += "\"dealId\":" + (string)dealId;
   s += ",\"orderId\":" + (string)HistoryDealGetInteger(dealId, DEAL_ORDER);
   s += ",\"entry\":\"" + e + "\"";
   s += ",\"price\":" + DoubleToString(HistoryDealGetDouble(dealId, DEAL_PRICE), 5);
   s += ",\"volume\":" + DoubleToString(HistoryDealGetDouble(dealId, DEAL_VOLUME), 2);
   s += ",\"profit\":" + DoubleToString(HistoryDealGetDouble(dealId, DEAL_PROFIT), 2);
   s += ",\"commission\":" + DoubleToString(HistoryDealGetDouble(dealId, DEAL_COMMISSION), 2);
   s += ",\"swap\":" + DoubleToString(HistoryDealGetDouble(dealId, DEAL_SWAP), 2);
   s += ",\"fee\":" + DoubleToString(HistoryDealGetDouble(dealId, DEAL_FEE), 2);
   s += ",\"timeUtc\":" + (string)tUtc;
   s += ",\"reason\":\"" + r + "\"";
   s += ",\"dealType\":" + (string)HistoryDealGetInteger(dealId, DEAL_TYPE);
   s += ",\"comment\":\"" + JsonEsc(HistoryDealGetString(dealId, DEAL_COMMENT)) + "\"";
   s += "}";
   return s;
}

string BuildAccountJson()
{
   string s = "{";
   s += "\"login\":" + (string)AccountInfoInteger(ACCOUNT_LOGIN);
   s += ",\"server\":\"" + JsonEsc(AccountInfoString(ACCOUNT_SERVER)) + "\"";
   s += ",\"company\":\"" + JsonEsc(AccountInfoString(ACCOUNT_COMPANY)) + "\"";
   s += ",\"currency\":\"" + JsonEsc(AccountInfoString(ACCOUNT_CURRENCY)) + "\"";
   s += ",\"leverage\":" + (string)AccountInfoInteger(ACCOUNT_LEVERAGE);
   s += ",\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2);
   s += ",\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2);
   s += ",\"margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2);
   s += ",\"freeMargin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2);
   s += ",\"marginLevel\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL), 2);
   s += ",\"isDemo\":" + (AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO ? "true" : "false");
   s += "}";
   return s;
}

//------------------------------------------------------------------
// Queue: every event is written to disk first, then flushed in order.
void EnqueueEvent(string eventId, string type, string positionJson, string dealJson)
{
   string j = "{\"schemaVersion\":1";
   j += ",\"eventId\":\"" + JsonEsc(eventId) + "\"";
   j += ",\"type\":\"" + type + "\"";
   j += ",\"sentAtUtc\":" + (string)((long)TimeGMT());
   j += ",\"account\":" + BuildAccountJson();
   if(positionJson != "") j += ",\"position\":" + positionJson;
   if(dealJson != "")     j += ",\"deal\":" + dealJson;
   j += "}";

   int h = FileOpen(QUEUE_FILE, FILE_READ|FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_SHARE_READ);
   if(h == INVALID_HANDLE) { Print("JournalSync: cannot open queue file ", GetLastError()); return; }
   FileSeek(h, 0, SEEK_END);
   FileWriteString(h, j + "\n");
   FileClose(h);
   FlushQueue();
}

void FlushQueue()
{
   if(g_flushing) return;
   g_flushing = true;

   if(!FileIsExist(QUEUE_FILE)) { g_flushing = false; return; }
   int h = FileOpen(QUEUE_FILE, FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE);
   if(h == INVALID_HANDLE) { g_flushing = false; return; }

   string lines[]; int n = 0;
   while(!FileIsEnding(h))
   {
      string line = FileReadString(h);
      if(StringLen(line) > 2) { ArrayResize(lines, n + 1); lines[n++] = line; }
   }
   FileClose(h);
   if(n == 0) { g_flushing = false; return; }

   int sent = 0;
   for(int i = 0; i < n; i++)
   {
      int code = Post(lines[i]);
      // 2xx -> done. 4xx (except 408/429) -> drop poison message. else retry later.
      if((code >= 200 && code < 300) || (code >= 400 && code < 500 && code != 408 && code != 429))
         sent++;
      else break;                      // keep order: stop at first failure
      if(sent >= 20) break;            // do not block the terminal too long
   }
   if(sent > 0)
   {
      int w = FileOpen(QUEUE_FILE, FILE_WRITE|FILE_TXT|FILE_ANSI);   // rewrite remaining
      if(w != INVALID_HANDLE)
      {
         for(int k = sent; k < n; k++) FileWriteString(w, lines[k] + "\n");
         FileClose(w);
      }
   }
   g_flushing = false;
}

int Post(const string json)
{
   char body[], res[]; string resHeaders;
   StringToCharArray(json, body, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(body, ArraySize(body) - 1);              // strip trailing \0
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + InpApiKey + "\r\n";
   ResetLastError();
   int code = WebRequest("POST", InpApiUrl, headers, InpTimeoutMs, body, res, resHeaders);
   if(code == -1)
   {
      Print("JournalSync: WebRequest error ", GetLastError(), " (is the URL whitelisted in Tools>Options>Expert Advisors?)");
      return -1;
   }
   if(InpVerbose) Print("JournalSync: HTTP ", code);
   return code;
}

//------------------------------------------------------------------
long ServerOffsetSec() { return (long)(TimeTradeServer() - TimeGMT()); }

string JsonEsc(string s)
{
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   StringReplace(s, "\r", " ");
   StringReplace(s, "\n", " ");
   StringReplace(s, "\t", " ");
   return s;
}

void Backfill(int days)
{
   datetime from = TimeCurrent() - (datetime)(days * 86400);
   if(!HistorySelect(from, TimeCurrent())) return;
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong d = HistoryDealGetTicket(i);
      if(d > 0) SendDeal(d);
   }
}
```

### 6.1 EA behaviors that MUST remain

- Event IDs are deterministic (`deal:<ticket>`) → safe retries, safe backfills.
- Queue is on disk; order is preserved.
- Poison messages (4xx) are dropped so the queue never blocks.
- `OnTimer` heartbeat updates "last seen" and the equity snapshot (powers the "Connected / Offline" badge in the UI).
- **Strategy tagging from MT5:** if the user trades manually, they can write `S:ICT-OB` in the order comment; if they use bots, each bot has a unique **magic number** mapped to a strategy on the website.

### 6.2 Testing the EA without risk

- Provide `scripts/send-fake-event.ts` (curl-equivalent) so the whole pipeline can be tested without MT5.
- Test on a **demo account first**.

### 6.3 Security notes for the README

- The ingest key only allows _writing events for one account_. It cannot read data. If leaked → rotate it.
- Never put the key in the repo. Use MT5 input field only.
- All traffic is HTTPS (WebRequest enforces whitelisting).

### 6.4 Alternate adapter (Option B, MetaApi) — later

Implement `lib/ingest/adapters/metaapi.ts` that maps MetaApi's webhook/stream payloads to the normalized schema (4.2) and calls the same `reduceEvent()` function. No UI change needed.

### 6.5 Real-time delivery to the browser

Vercel serverless functions can't hold WebSocket connections, so use a managed pub/sub:

1. After a successful ingest transaction, `lib/realtime/publish.ts` triggers `pusher.trigger(\`private-user-${userId}\`, "trade.updated", { accountId, tradeId, type })`.
2. In the client, a `<RealtimeProvider>` (client component) subscribes with `pusher-js` (private channel, auth endpoint `/api/realtime/auth` verifying the session) and on event calls `queryClient.invalidateQueries({ queryKey: ["trades"] })` plus `router.refresh()` where Server Components display the data.
3. **Fallback:** if Pusher env vars are absent, TanStack Query `refetchInterval: 5000` while the tab is visible (`refetchIntervalInBackground: false`).
4. Show a small toast ("New trade: XAUUSD Buy @ 2321.35") and a subtle row highlight (fade 1.5 s) — no heavy animation.

---

## 7. DATABASE & HOSTING (FREE)

- **Neon Postgres** via **Vercel → Storage / Marketplace → Neon** (free tier). It injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (for migrations).
- **Drizzle:**
  - `drizzle.config.ts` uses the unpooled URL for `drizzle-kit migrate`.
  - Runtime uses `@neondatabase/serverless` with the pooled URL.
  - Use **`neon-serverless` (Pool)** where you need **transactions** (the ingest reducer). `neon-http` does not support interactive transactions — verify with docs.
  - Commit generated migrations (`drizzle/` folder). Run `pnpm db:migrate` in the Vercel build via a `"vercel-build"` script or a CI step.
- **Vercel Blob** for screenshots (`BLOB_READ_WRITE_TOKEN` auto-injected when you create a Blob store).
- **Local development:** use a Neon dev branch (free) or Docker Postgres. Provide `docker-compose.yml` with Postgres and `.env.example`.
- **Free-tier awareness:** keep payloads small; prune `trade_events` older than 90 days; compress screenshots client-side; add `/api/health` route.

---

## 8. PAGES & INFORMATION ARCHITECTURE

```
app/
  (marketing)/page.tsx           → public landing (SEO) + Login CTA
  (auth)/login/page.tsx
  (app)/layout.tsx               → sidebar/topbar, account switcher, auth guard
  (app)/dashboard/page.tsx       → KPIs, equity curve, calendar heatmap, recent trades
  (app)/trades/page.tsx          → data table + filters (server-driven via URL params)
  (app)/trades/[id]/page.tsx     → trade detail (also rendered as intercepting-route side sheet)
  (app)/analytics/page.tsx       → by strategy / symbol / style / weekday / hour
  (app)/strategies/page.tsx      → CRUD strategies + magic-number mapping
  (app)/accounts/page.tsx        → CRUD accounts: rename, ingest key, connection status
  (app)/settings/page.tsx        → timezone, currency display, theme, data export
  api/ingest/route.ts
  api/blob/upload/route.ts
  api/realtime/auth/route.ts
  api/cron/prune/route.ts
  api/health/route.ts
  sitemap.ts  robots.ts  manifest.ts  opengraph-image.tsx
```

### 8.1 Account switcher & renaming (Requirement #4)

- Top-left **Account Switcher** (shadcn `Command` + `Popover`): shows `display_name`, login (masked, e.g. `••••5678`), broker, DEMO/LIVE badge, connection dot (green if `last_seen_at` < 3 min, amber < 15 min, red otherwise).
- Options: "All accounts" (aggregated, only if same currency, otherwise warn) or a single account.
- Selected account is stored in the **URL (`?account=<id>`) and a cookie** so Server Components can read it.
- **Rename:** inline edit in the Accounts page and in the switcher (pencil icon) → Server Action `renameAccount`. Every trade table row displays an account chip when "All accounts" is selected.

### 8.2 Trade detail page (Requirement #2)

Sections:

1. **Header:** symbol, direction badge, status (Open/Closed), account chip, strategy chip, style chip (Scalp/Swing…), net P/L (green/red), R-multiple.
2. **Key numbers grid:** Entry, Exit, SL, TP, initial SL, volume, risk amount, RR planned vs achieved, duration, commission, swap, balance before/after.
3. **Screenshots gallery:** upload zone (drag-drop, click, **paste from clipboard Ctrl/Cmd+V**), kind selector (Entry / Exit / HTF context), caption, reorder, delete, lightbox viewer with zoom and keyboard navigation.
4. **Journal:** strategy select, style select (auto-detected value shown, user can override → `style_source='manual'`), rating stars, emotion select, setup tags, mistake tags, rich notes (simple Markdown textarea with preview — do not add a heavy editor).
5. **Timeline:** deals table (entries, partial closes, exit) and SL/TP modification history (from `trade_events`).
6. Autosave notes with debounce + optimistic UI (`useOptimistic`) and an "Saved" indicator.

On the trades list, clicking a row opens this in a **side sheet via Next.js intercepting + parallel routes** (`@modal/(.)trades/[id]`) with a deep-linkable full page fallback. Quick action "Add screenshot" on the latest trade from the dashboard.

---

## 9. SCALP vs SWING SPECIFICATION

Field `trades.style` ∈ `scalp | day | swing | position`.

**Auto-classification by holding time (`lib/trade-style.ts`, pure function + unit tests, thresholds configurable in Settings):**

| Style    | Duration                                     |
| -------- | -------------------------------------------- |
| scalp    | < 15 minutes (default setting)               |
| day      | 15 min – 24 h, closed same trading day       |
| swing    | > 1 day and ≤ 2 weeks (i.e., held overnight) |
| position | > 2 weeks                                    |

Rules:

- While a trade is **open**, style = strategy's `default_style` if set, else `day`; re-classify on close **unless** `style_source = 'manual'`.
- The user can override at any time; show an "Auto" tag next to automatic values.
- Analytics must show scalp vs swing performance side by side (win rate, avg R, expectancy, profit factor, avg duration).
- Filter chips for style on the trades page.

---

## 10. METRICS (compute in SQL where possible, helpers in `lib/metrics.ts`)

Net P/L, gross profit/loss, win rate, profit factor, expectancy (avg R), average win/loss, payoff ratio, max drawdown (from `balance_snapshots`), best/worst trade, longest win/loss streak, average hold time, trades per day, P/L by weekday/hour/symbol/strategy/style, R-multiple distribution, equity curve, daily P/L calendar heatmap.

- `risk_amount = |entry − initial_sl| × contractSize × volume` — **only when contract size/tick value is known**; otherwise approximate using `(profit / pips)` of closing deals, or leave `r_multiple` null. Send `tickValue`/`tickSize` from the EA if needed in schema v2 (`SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE)` and `SYMBOL_TRADE_TICK_SIZE`) — **recommended: add these two fields to the position payload now and compute `risk_amount = |entry − initial_sl| / tickSize × tickValue × volume`.**
- Keep percentages with `Decimal`, format with `Intl.NumberFormat`.

---

## 11. FILTERS (Requirement #5)

Filters live in the **URL** via `nuqs` (shareable, back-button friendly, server-rendered).

| Filter                 | Control                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| Date range             | Presets (Today, 7D, 30D, This month, Last month, YTD, Custom) via shadcn `Calendar` range |
| Account                | Account switcher                                                                          |
| Symbol                 | Multi-select combobox                                                                     |
| Direction              | Segmented: All / Buy / Sell                                                               |
| Status                 | Open / Closed                                                                             |
| Result                 | Win / Loss / Breakeven                                                                    |
| Strategy               | Multi-select                                                                              |
| Style                  | Scalp / Day / Swing / Position chips                                                      |
| Tags (setup / mistake) | Multi-select                                                                              |
| P/L range, R range     | Range slider / min-max inputs                                                             |
| Has screenshot         | Toggle                                                                                    |
| Rating                 | Stars                                                                                     |
| Search                 | Debounced text (symbol, comment, notes)                                                   |

UX details:

- Sticky filter bar on desktop; on mobile a **"Filters" button opening a bottom Sheet** with an "Apply / Reset" footer and active-filter count badge.
- Active filters are displayed as removable chips with a "Clear all".
- A **Saved views** feature (name + URL params saved in DB) is a nice-to-have.
- **Server-side** filtering, sorting, and cursor/keyset pagination in Drizzle (`lib/queries/trades.ts` single query builder used by both page and export). Never filter client-side on the full dataset.
- Table: column visibility toggle, sticky header, row density, CSV export of the filtered set.

---

## 12. UI / UX DESIGN SYSTEM (Senior UI/UX standard)

### 12.1 Principles

- **Calm, data-dense, professional** (think Linear / Stripe dashboard / TraderSync, but cleaner). **Low animation:** only 120–200 ms opacity/transform transitions, hover/focus feedback, sheet/dialog enter-exit, skeleton loaders. No parallax, no bouncing, no confetti. Respect `prefers-reduced-motion`.
- Neutral gray palette + one brand accent. **Semantic colors** only for P/L: green (profit), red (loss), amber (warning/open), blue (info). Never use red/green alone — add +/− sign and icons for color-blind users.
- **Dark mode default + light mode** (`next-themes`). Define all colors as CSS variables (shadcn tokens) in `globals.css` using Tailwind v4 `@theme`.
- **Typography:** `next/font` with **Inter** (UI) and **JetBrains Mono / Geist Mono** (numbers/prices, `font-variant-numeric: tabular-nums`). Right-align numeric columns.
- 4/8 px spacing scale, radius 8–12 px, subtle borders instead of heavy shadows.
- WCAG AA contrast, visible focus rings, full keyboard navigation, ARIA labels on icon buttons, 44×44 px minimum touch targets on mobile.

### 12.2 Layout

- **Desktop:** collapsible left sidebar (Dashboard, Trades, Analytics, Strategies, Accounts, Settings), top bar with account switcher, global search (`Cmd+K` command palette), live-connection indicator, theme toggle, user menu.
- **Mobile (mobile-first CSS):**
  - Sidebar becomes a **bottom tab bar** (Dashboard, Trades, Analytics, Accounts, More).
  - Data table collapses into **trade cards** (symbol, direction, P/L, strategy chip, time) using a responsive component switch (`hidden md:block` / `md:hidden`) fed by the same data hook.
  - Filters in bottom sheet, detail view full-screen with sticky header, upload via camera/gallery (`<input type="file" accept="image/*" capture>` fallback).
  - Charts are touch-friendly, horizontally scrollable if needed, no hover-only information.
  - Safe-area padding (`env(safe-area-inset-*)`).
- Test breakpoints: 360, 390, 768, 1024, 1280, 1536 px.

### 12.3 Component library (build once, reuse everywhere — **no duplication**)

Use shadcn/ui primitives: `Button, Input, Select, Combobox(Command+Popover), Calendar, DatePicker, Dialog, Sheet, Drawer, Tabs, Badge, Card, Table, DropdownMenu, Tooltip, Skeleton, Sonner (toasts), Form, Checkbox, Switch, Slider, Avatar, Separator, ScrollArea, Chart`.

Shared composites (in `components/`):

- `PnlText` (formatted, signed, colored, with icon)
- `DirectionBadge`, `StyleBadge`, `StrategyBadge`, `StatusBadge`, `AccountChip`
- `StatCard`, `DataTable` (generic, TanStack), `DataTableToolbar`, `FilterBar`, `FilterChips`, `MultiSelect`, `DateRangePicker`
- `EmptyState`, `ErrorState`, `PageHeader`, `ConfirmDialog`
- `ImageUploader`, `ImageGallery`, `Lightbox`
- `ConnectionStatus`
- `CopyButton`
- `TradeCard` (mobile) + `TradeRow` (desktop) sharing `useTradeDisplay()` formatting helpers.

Shared libs: `lib/format.ts` (money, price by symbol digits, percent, duration, date in user TZ), `lib/constants.ts`, `lib/utils.ts (cn)`, `lib/validators/*` (Zod schemas reused by forms, Server Actions, and API).

### 12.4 States

Every data view needs: **loading (skeleton)**, **empty (with CTA, e.g. "Install the EA → show steps")**, **error (retry)**, **success**. Add an **Onboarding checklist** on first run (1. Create account 2. Copy key 3. Install EA 4. First trade received ✔).

---

## 13. PERFORMANCE (Requirement #7)

- **Server Components + streaming:** wrap slow widgets in `<Suspense fallback={<Skeleton/>}>` so the shell renders instantly.
- Use **Cache Components / `"use cache"` with `cacheTag` / `cacheLife`** (per verified Next version) for expensive aggregates, and **invalidate with `revalidateTag` / `updateTag`** from the ingest handler after each commit so the dashboard is both fast and fresh.
- Keep the ingest route and DB **in the same region** (set Vercel function region close to the Neon region, e.g. `iad1`).
- **Database:** indexes in 4.3; keyset pagination; select only needed columns; aggregate in SQL; never `SELECT *` for lists.
- **Images:** screenshots are compressed client-side (max ~1920 px wide, WebP/JPEG quality 0.8) before upload; display with `next/image` (`sizes` set, `placeholder="blur"` using a stored tiny blurDataURL if available); lightbox lazy-loaded with `next/dynamic`.
- **JS budget:** lazy-load charts and lightbox (`next/dynamic`, `ssr:false` only where needed); import icons individually from `lucide-react`; avoid heavy deps (no moment, no lodash full); run `@next/bundle-analyzer` and keep each route's first-load JS lean.
- **Fonts:** `next/font` with `display: swap`, subset latin.
- **React Compiler:** enable if stable in the installed Next version (`reactCompiler: true`) — verify; fixes unnecessary re-renders automatically.
- **Virtualize** long tables only if the page size exceeds ~200 rows (default page size 25–50).
- Targets: **Lighthouse ≥ 95** (Performance, Accessibility, Best Practices, SEO) on the landing page; LCP < 2.0 s, CLS < 0.05, INP < 200 ms on key app pages. Enable **Vercel Speed Insights**.

---

## 14. SEO (Requirement #7)

The app itself is private (behind login) so only public pages are indexable:

- Public landing page `/` (what the journal does, features, screenshots, FAQ) with **semantic HTML**, single `<h1>`, descriptive headings, alt texts.
- `generateMetadata` / `export const metadata` with `title.template`, `description`, `metadataBase`, canonical URL, **Open Graph + Twitter cards**, `opengraph-image.tsx`.
- JSON-LD (`SoftwareApplication` + `FAQPage`) in the landing page.
- `app/sitemap.ts` (public routes only), `app/robots.ts` (disallow `/dashboard`, `/trades`, `/api`, etc.).
- **All private pages:** `export const metadata = { robots: { index: false, follow: false } }`.
- `manifest.ts` + icons → installable **PWA-lite** (add-to-home-screen on mobile).
- Clean URLs, fast TTFB, `lang="en"` on `<html>`, proper 404 page (`not-found.tsx`) and error boundaries (`error.tsx`, `global-error.tsx`).

---

## 15. SECURITY, CONFIG & MAINTAINABILITY

### 15.1 Environment variables (`.env.example`, validated with `@t3-oss/env-nextjs`)

```
DATABASE_URL=
DATABASE_URL_UNPOOLED=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
BLOB_READ_WRITE_TOKEN=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=
NEXT_PUBLIC_APP_URL=
CRON_SECRET=
OWNER_EMAIL=            # only this email may register (single-user app)
```

### 15.2 Security checklist

- Auth guard in the `(app)` layout **and** inside every Server Action/Route Handler (never trust the layout alone). Check ownership: every query is scoped by `user_id` → `account_id`.
- Registration disabled after the owner is created (or restricted to `OWNER_EMAIL`).
- Ingest key hashed (SHA-256), constant-time compare, rate-limited, size-limited, schema-validated.
- Image upload: Vercel Blob **client upload token** route validates session, trade ownership, content-type (`image/png|jpeg|webp`), max size (e.g., 8 MB).
- Security headers in `next.config` (CSP with Pusher + Vercel Blob domains allowed, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`/`frame-ancestors`).
- No PII/keys in logs. Structured logging helper `lib/logger.ts`.
- Vercel Cron (`vercel.json`) → `/api/cron/prune` (protected by `CRON_SECRET`) to delete old `trade_events`, orphan blobs.

### 15.3 Maintainability

- **Folder structure** (feature-oriented):

```
src/
  app/                  routes only (thin)
  features/
    trades/ (components, actions.ts, queries.ts, schemas.ts, hooks.ts, types.ts)
    accounts/ strategies/ analytics/ dashboard/ journal-images/
  components/ui/        shadcn primitives
  components/shared/    composites (PnlText, DataTable, FilterBar...)
  lib/                  format, metrics, trade-style, env, auth, logger, realtime, ingest/
  db/                   schema.ts, client.ts, migrations in /drizzle
  tests/
```

- Path aliases (`@/`), ESLint rule to forbid cross-feature deep imports, Prettier + Husky + lint-staged, Conventional Commits.
- GitHub Actions: install → typecheck → lint → test → build.
- `README.md` with architecture diagram, setup, MT5/EA install steps, env guide, deployment steps, troubleshooting (WebRequest error 4060, 4014, URL not whitelisted, etc.).
- `docs/adr/` for key decisions (why Neon, why EA over MetaApi).

---

## 16. DEPLOYMENT ON VERCEL (step by step)

1. Push repo to GitHub.
2. Vercel → **Add New Project** → import repo (framework auto-detected: Next.js).
3. Vercel → **Storage** → add **Neon Postgres** (free) → connect to project (env vars auto-injected). Add **Blob** store. Add **Upstash Redis** from Marketplace (free).
4. Add the remaining env vars (Better Auth, Pusher, cron secret, owner email) for Production + Preview.
5. Build command: `pnpm db:migrate && pnpm build` (or a `vercel-build` script).
6. Set function region near the database. Add custom domain (optional) and **add that exact origin to MT5 WebRequest whitelist**.
7. Run first deploy, open `/api/health` (should return DB OK), create the owner account, create a trading account, copy the ingest key.
8. Install the EA (Section 3.3), place a demo trade, verify it appears in real time.
9. Enable Vercel Analytics + Speed Insights.

---

## 17. ACCEPTANCE CRITERIA (Definition of Done)

**Ingest & realtime**

- [ ] Opening a trade in MT5 shows in the journal within ~2 s with symbol, direction, volume, entry, SL, TP, balance.
- [ ] Modifying SL/TP updates the trade; `initial_sl` stays unchanged.
- [ ] Closing (manual, SL, TP, partial) updates exit, P/L, commission, swap, R, duration, status.
- [ ] Re-sending the same event creates no duplicates; out-of-order events resolve correctly.
- [ ] Turning the internet/website off, trading, then restoring → all queued events arrive in order.
- [ ] Deposits/withdrawals do not affect trade statistics but appear in balance history.
- [ ] Invalid/unauthorized requests get 401/403/422/429 and are never stored.

**Journal**

- [ ] Rename account anywhere; the name is displayed in the switcher, tables, and detail pages.
- [ ] Assign strategy (manual, by comment `S:CODE`, by magic number) and scalp/swing (auto + override).
- [ ] Upload, paste, view, reorder, delete screenshots on a trade; images are compressed and load fast.
- [ ] All filters in Section 11 work, are URL-driven and are server-side.

**Quality**

- [ ] Fully usable on 360 px wide screens; no horizontal scroll; tap targets ≥ 44 px.
- [ ] Lighthouse ≥ 95 on the landing page; app pages fast with skeletons, no layout shift.
- [ ] Dark and light themes both pass AA contrast.
- [ ] `typecheck`, `lint`, `test`, `build` pass. No duplicated components/logic. No `any`.
- [ ] README is complete; a new developer can deploy in < 30 minutes.

---

## 18. IMPLEMENTATION PHASES (follow in order)

1. **Scaffold:** `pnpm create next-app@latest` (TypeScript, Tailwind, ESLint, App Router, Turbopack, `src/`, `@/*` alias) → install shadcn/ui, theme tokens, fonts, Prettier, Vitest, env validation, folder structure.
2. **Database:** Drizzle schema (4.3), migrations, client, seed script (demo account + sample trades).
3. **Auth:** Better Auth, owner-only registration, `(app)` guard, login page.
4. **Accounts feature:** CRUD, rename, ingest-key create/rotate/hash, connection status, account switcher.
5. **Ingest API:** Zod schema, auth, rate-limit, idempotency, reducer (unit-tested with fixtures: open → modify → partial close → close; out-of-order; duplicates), `send-fake-event` script.
6. **EA:** save `JournalSync.mq5` to `/mt5/JournalSync.mq5` in the repo + README install guide.
7. **Strategies feature:** CRUD, magic-number map, comment-code parser, style classifier (Section 9).
8. **Trades list:** server query builder, filters (Section 11), table + mobile cards, CSV export.
9. **Trade detail:** key numbers, journal form (autosave), deals timeline, screenshots (Blob client upload, paste, gallery, lightbox), intercepting-route sheet.
10. **Dashboard & analytics:** KPIs, equity curve, calendar heatmap, breakdown charts, scalp vs swing comparison.
11. **Realtime:** Pusher publish/subscribe + polling fallback + toasts + cache tag invalidation.
12. **Polish:** empty/error/loading states, onboarding checklist, a11y pass, reduced motion, mobile QA across breakpoints.
13. **SEO & perf:** landing page, metadata, sitemap/robots, JSON-LD, OG image, bundle analysis, Lighthouse tuning.
14. **Hardening:** security headers, rate limits, cron prune, logging, e2e smoke test, CI.
15. **Docs & deploy:** README, ADRs, Vercel deployment, end-to-end verification with a demo MT5 account.

---

## 19. SENIOR "TRICKS" CHECKLIST

- **Idempotency key = MT5 deal ticket** → retries are free.
- **Recompute aggregates from raw deals** instead of incrementing → self-healing, order-independent.
- **Store raw payloads (`trade_events.jsonb`)** → you can reprocess history if the reducer improves.
- **Schema versioning** (`schemaVersion`) on the wire → EA and website can evolve separately.
- **UTC everywhere in DB, local time only at display.**
- **Numeric strings for money** across the server/client boundary to avoid float drift.
- **Single query builder** for list, export, and analytics filters → no logic drift.
- **URL as the source of truth for filters** → shareable, SSR-friendly.
- **Optimistic UI** for notes/tags/strategy edits.
- **Heartbeat** distinguishes "no trades" from "EA disconnected".
- **Tick value/size from the EA** gives correct risk and R-multiples for FX, metals, indices, and crypto.
- **Prune + cap** (events 90 days, images compressed) to stay inside free tiers.
- **Feature flags via env** (e.g., Pusher on/off) with graceful fallbacks.
- **Test the reducer heavily; keep UI thin.** The reducer is where correctness lives.

---

## 20. FINAL DELIVERABLES

1. Complete Next.js repository following Sections 2–15.
2. `mt5/JournalSync.mq5` (Section 6) tested on a demo account.
3. `README.md` with setup, MT5/EA installation, environment variables, Vercel deployment steps, troubleshooting.
4. `.env.example`, `drizzle/` migrations, seed script, `scripts/send-fake-event.ts`.
5. Passing CI (typecheck, lint, tests, build).

**Final instruction to the coding model:** if any requirement here conflicts with the documentation of the installed library versions, follow the current official documentation, keep the _behavior_ described here, and note the deviation in `docs/adr/`. Do not skip phases, do not leave TODOs for core features, and do not introduce code duplication.
