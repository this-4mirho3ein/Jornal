# JournalSync.mq5 — MT5 → Trading Journal bridge

`JournalSync.mq5` is a MetaTrader 5 Expert Advisor that pushes every trade
event from your MT5 account to your journal's `/api/ingest` endpoint, in
(real) time, with a **persistent disk queue** so nothing is lost when the
site, the internet, or the terminal itself goes down and restarts.

What it sends:

| Event             | When                                                       |
| ----------------- | ---------------------------------------------------------- |
| `deal_open`       | a position opens (entry deal executed)                     |
| `deal_close`      | a deal exits (full close, partial close, SL/TP, stop-out)  |
| `position_modify` | SL/TP changed on an open position                          |
| `cash_op`         | deposit / withdrawal / credit / bonus (balance operations) |
| `heartbeat`       | every `InpHeartbeatSec` (powers the Connected / Offline badge and equity snapshots) |

Partial closes produce one `deal_close` per exit deal — the journal
re-aggregates the full position from its deals (order-independent), so retries
and out-of-order delivery are always safe.

> **The important truth about "MT5 on the web"** (spec §3.1): the MetaTrader 5
> **Web Terminal (browser) does NOT support Expert Advisors.** If you only use
> the web terminal, either install MT5 desktop on a VPS with this EA (best),
> or use the MetaApi option (a read-only cloud adapter — planned as a later
> task). This EA is **Option A (primary)**: desktop MT5 + `WebRequest`, free,
> event-driven, no passwords shared with third parties.

---

## 1. Install (once, ~5 minutes)

1. MT5 desktop → **Tools → Options → Expert Advisors**.
2. Tick **"Allow WebRequest for listed URL"** and add your journal origin —
   e.g. `https://YOUR-APP.vercel.app` (exact origin, **no path**; add your
   custom domain too if you use one). Also add `http://localhost:3000` while
   testing locally.
3. Tick **"Allow algorithmic trading"**.
4. Copy `JournalSync.mq5` into your terminal's `MQL5/Experts/` folder
   (MetaEditor: **File → Open Data Folder**), then open it in MetaEditor and
   press **F7** to compile.
5. Open any one chart and drag **Expert Advisors → JournalSync** onto it.
   **One EA instance per account is enough** — it receives events for ALL
   symbols on that account. Don't attach it twice.
6. Set the inputs:
   - `InpApiUrl` — `https://YOUR-APP.vercel.app/api/ingest`
     (or `http://localhost:3000/api/ingest` locally)
   - `InpApiKey` — an ingest key from the website's **Accounts** page
     (shown once at creation; rotate there if it leaks)
7. Keep the terminal running. See [section 5](#5-keeping-mt5-running) for VPS
   recommendations.

Optional inputs:

| Input             | Default | Meaning                                                       |
| ----------------- | ------- | ------------------------------------------------------------- |
| `InpHeartbeatSec` | `60`    | heartbeat + queue-flush cadence (seconds)                     |
| `InpTimeoutMs`    | `8000`  | WebRequest timeout                                            |
| `InpBackfillDays` | `0`     | > 0: on first start, send all deals of the last N days (idempotent — safe to re-run) |
| `InpVerbose`      | `false` | log every HTTP status and queue flush to the Experts log      |

## 2. Strategy tagging (how your trades get labeled)

Two ways, both automatic — nothing else to do in the EA:

- **Manual trading:** write a strategy code in the order **comment** field,
  e.g. `S:ICT-OB`. The journal parses the `S:<code>` marker from the position
  comment and assigns that strategy.
- **Bot trading:** each bot uses a unique **magic number**. On the website
  (Strategies page) map `magic → strategy` per account — every trade with that
  magic is auto-assigned. Magic wins over the comment marker.

Define the strategies beforehand so codes/`S:` markers match exactly.

## 3. Testing without risk (do this first)

1. **Demo account first.** Attach the EA to a demo-account chart and place a
   couple of manual trades; you should see green `JournalSync: HTTP 200`
   lines in the Experts tab (`InpVerbose = true`).
2. **Without MT5 at all**, exercise the whole pipeline (auth, validation,
   reducer, dedupe) from the repo with the fake-event script:

   ```bash
   pnpm tsx scripts/send-fake-event.ts --key <INGEST_KEY> --type full
   # a realistic lifecycle: open → SL modify → partial close → close → heartbeat → deposit

   # re-run the exact same sequence:
   pnpm tsx scripts/send-fake-event.ts --key <INGEST_KEY> --type full
   # → every step reports {"duplicate":true} (idempotency proof)

   # a fresh --posId creates a fresh position:
   pnpm tsx scripts/send-fake-event.ts --key <INGEST_KEY> --type full --posId 777000222
   ```

   Add `--url http://localhost:3000/api/ingest` for local, or your Vercel URL
   for production.

3. **Restart test:** kill MT5 mid-test, make trades if possible, reopen —
   queued events flush from `MQL5/Files/journal_queue.jsonl` in order; the
   server dedupes replays.

Times: deal times arrive at the EA in **broker server time**; the EA converts
them to UTC epoch seconds (server-vs-GMT offset) before sending. The journal
stores UTC and displays it in your account timezone.

## 4. Security notes

- The ingest key only allows **writing events** for its one account. It cannot
  read any data. Leaked? Rotate it on the Accounts page and update the EA input.
- Never commit the key anywhere (repo, screenshots, logs). Enter it only in
  the EA's `InpApiKey` input — it lives in the terminal's local settings.
- All traffic is HTTPS — WebRequest only posts to URLs you explicitly
  whitelisted in MT5's options.

## 5. Keeping MT5 running

The EA only works while the desktop terminal is open and connected. Options:

- **MetaQuotes built-in VPS** — right-click the account in the Navigator →
  *Register a Virtual Server*; you can migrate an already-running terminal
  (EA included). Simplest; ~$10–15/mo.
- **Any cheap Windows VPS** (~$5–10/mo) — install MT5 + EA, log in, leave it.
- **Your own PC** — fine for testing; the terminal must stay open.
- **Mac:** MT5 desktop runs via **PlayOnMac / Wine / CrossOver** (MetaQuotes
  ships a PlayOnMac installer). Apple Silicon runs the x86 build through
  Rosetta-compatible Wine layers; compile with F7 there the same way.

## 6. Troubleshooting

| Symptom                                                        | Cause / fix                                                                                                                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Log: `WebRequest error 4060` / `4014`                          | WebRequest is not allowed: tick **Allow WebRequest for listed URL** (Tools → Options → Expert Advisors) and restart MT5 after adding the URL.         |
| Log: `WebRequest error 4060` even though whitelisted            | URL mismatch: the whitelist stores **origins only** (`https://yourapp.vercel.app`, no `/path`), and `http` vs `https` are different origins.          |
| Server replies `401`                                            | Wrong/rotated `InpApiKey`, or a key for a different account. Re-copy the key from the Accounts page. Rate-limited requests reply `429` instead.       |
| `Alert: JournalSync: set InpApiKey`                             | Fill `InpApiKey` (≥ 10 chars) in the EA inputs.                                                                                                       |
| No events arrive                                                | "Algo trading" enabled? EA attached to only **one** chart? Key/URL inputs set? Watch the Experts tab with `InpVerbose = true`.                          |
| `journal_queue.jsonl` keeps growing in `MQL5/Files`             | The site is unreachable (or 5xx) — events are safe on disk and flush in order once connectivity returns. Check the site and your whitelisted origin. |
| Same events applied twice?                                      | They aren't — event IDs are deterministic (`deal:<ticket>`), and the server dedupes replays (`{"duplicate":true}`), including after restarts/backfills. |
| Deposit/withdrawal shows wrong type                             | The journal derives deposit vs withdrawal from the amount sign — check the operation on the broker side.                                              |
| Compile warnings on your MetaEditor build                       | The file follows current MQL5 docs; minor warnings on older builds are expected — fix locally and keep structure/behavior (spec §6 note).             |

## 7. Deviations from the spec §6 skeleton

The shipped EA (kept spec-faithful in structure/behavior; header documents all
of them inline) additionally:

1. sends `tickValue`/`tickSize` per position (spec §10 "add now") → the journal
   computes exact `risk_amount` and `r_multiple`; omitted when a symbol can't
   provide them;
2. omits `orderId` when it is 0 (balance operations) so cash ops never fail
   validation;
3. emits fully-closed positions with `volume: 0` — accepted by the wire schema
   (spec §6's own `BuildClosedPositionJson` behavior);
4. uses epoch-second heartbeat eventIds and collision-safe `position_modify`
   eventIds;
5. stores its queue as UTF-8 (broker comments in any language survive).

MQL5 cannot be compiled in this repo (Windows-only toolchain) — the file was
verified by line-by-line review against MQL5 documentation, and the full
pipeline contract is covered by `src/tests/unit/ingest/` from the API side.
