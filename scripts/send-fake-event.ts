/**
 * send-fake-event.ts — EA stand-in for smoke tests (task 05, spec §20.4).
 *
 * Builds §4.2-shaped events with deterministic eventIds: re-running the same
 * sequence with the same --posId returns `{ duplicate: true }` for every
 * step (idempotency proof); a new --posId creates a fresh position.
 *
 * Usage:
 *   pnpm tsx scripts/send-fake-event.ts --key <INGEST_KEY> \
 *     [--url http://localhost:3000/api/ingest] \
 *     [--type full|open|modify|close|heartbeat|cash_op] \
 *     [--posId 777000101] [--symbol XAUUSD] \
 *     [--login 53245507] [--server Alpari-MT5-Demo] [--demo]
 */
interface Args {
  url: string;
  key: string;
  type: "full" | "deal_open" | "position_modify" | "deal_close" | "heartbeat" | "cash_op";
  posId: number;
  symbol: string;
  /** MT5-reported identity — defaults to mock values, override to test the
   *  real account binding (ADR 0007: the reducer adopts what the EA sends). */
  login?: number;
  server?: string;
  demo?: boolean;
  company?: string;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    url: "http://localhost:3000/api/ingest",
    key: "",
    type: "full",
    posId: 777000101,
    symbol: "XAUUSD",
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1] ?? "";
    if (flag === "--url") { args.url = value; i++; }
    else if (flag === "--key") { args.key = value; i++; }
    else if (flag === "--type") {
      if (value !== "full" && value !== "open" && value !== "modify" && value !== "close" && value !== "heartbeat" && value !== "cash_op") {
        console.error(`unsupported --type: ${value}`);
        process.exit(2);
      }
      args.type = value === "open" ? "deal_open"
        : value === "modify" ? "position_modify"
        : value === "close" ? "deal_close"
        : value;
      i++;
    }
    else if (flag === "--posId") { args.posId = Number(value); i++; }
    else if (flag === "--symbol") { args.symbol = value.toUpperCase(); i++; }
    else if (flag === "--login") { args.login = Number(value); i++; }
    else if (flag === "--server") { args.server = value; i++; }
    else if (flag === "--demo") { args.demo = true; }
    else if (flag === "--company") { args.company = value; i++; }
  }
  if (!args.key) {
    console.error("missing --key (the account ingest key)");
    process.exit(2);
  }
  return args;
}

const TICK_META: Record<string, { tickSize: number; tickValue: number }> = {
  XAUUSD: { tickSize: 0.01, tickValue: 1 },
  EURUSD: { tickSize: 0.00001, tickValue: 1 },
  US500: { tickSize: 0.1, tickValue: 1 },
};
const DEFAULT_META = TICK_META["XAUUSD"];

interface StoryStep {
  label: string;
  payload: Record<string, unknown>;
}

/**
 * One realistic position lifecycle: open → SL tighten → partial close →
 * final close → heartbeat → cash deposit. Pure function of (posId, symbol).
 */
function buildStory(args: Args, t0: number): StoryStep[] {
  const meta = TICK_META[args.symbol] ?? DEFAULT_META;
  const pos = args.posId;
  const login = args.login ?? 51234567 + (pos % 7);
  const account = {
    login,
    server: args.server ?? "ICMarketsSC-MT5",
    company: args.company ?? "Raw Trading Ltd",
    currency: "USD",
    leverage: 500,
    isDemo: args.demo ?? false,
  };
  const balance = 102_500 + (pos % 500);
  const entryBase = 2320 + (pos % 100) / 100;

  const openPayload: Record<string, unknown> = {
    schemaVersion: 1,
    eventId: `fake:${pos}:open:0`,
    type: "deal_open",
    sentAtUtc: t0,
    account: {
      ...account,
      balance,
      equity: balance + 35.5,
      margin: 232.5,
      freeMargin: balance - 200,
      marginLevel: 4400.3,
    },
    position: {
      positionId: pos,
      symbol: args.symbol,
      direction: "buy",
      magic: 1001,
      comment: "S:ICT-SB",
      volume: 0.1,
      sl: entryBase - 10,
      tp: entryBase + 30,
      tickValue: meta.tickValue,
      tickSize: meta.tickSize,
    },
    deal: {
      dealId: pos * 10,
      orderId: pos,
      entry: "in",
      price: entryBase,
      volume: 0.1,
      profit: 0,
      commission: -0.7,
      swap: 0,
      fee: 0,
      timeUtc: t0,
      reason: "client",
    },
  };

  const modifyPayload: Record<string, unknown> = {
    schemaVersion: 1,
    eventId: `fake:${pos}:modify:0`,
    type: "position_modify",
    sentAtUtc: t0 + 600,
    account: {
      ...account,
      balance,
      equity: balance + 12,
      margin: 232.5,
      freeMargin: balance - 200,
      marginLevel: 4300,
    },
    position: {
      positionId: pos,
      symbol: args.symbol,
      direction: "buy",
      magic: 1001,
      comment: "S:ICT-SB",
      volume: 0.1,
      sl: entryBase - 6,
      tp: entryBase + 30,
    },
  };

  const closePart = (n: number, volume: number, price: number, profit: number, offsetSec: number, reason: string): StoryStep => ({
    label: "deal_close",
    payload: {
      schemaVersion: 1,
      eventId: `fake:${pos}:close:${n}`,
      type: "deal_close",
      sentAtUtc: t0 + offsetSec,
      account: {
        ...account,
        balance: balance + profit,
        equity: balance + profit,
        margin: 0,
        freeMargin: balance + profit,
        marginLevel: 0,
      },
      position: {
        positionId: pos,
        symbol: args.symbol,
        direction: "buy",
        magic: 1001,
        comment: "S:ICT-SB",
        volume: 0.1 - volume,
        sl: entryBase - 6,
        tp: entryBase + 30,
        tickValue: meta.tickValue,
        tickSize: meta.tickSize,
      },
      deal: {
        dealId: pos * 10 + n,
        orderId: pos + n,
        entry: "out",
        price,
        volume,
        profit,
        commission: -0.3,
        swap: 0,
        fee: 0,
        timeUtc: t0 + offsetSec,
        reason,
      },
    },
  });

  const heartbeat: StoryStep = {
    label: "heartbeat",
    payload: {
      schemaVersion: 1,
      eventId: `fake:${pos}:hb:0`,
      type: "heartbeat",
      sentAtUtc: t0 + 600,
      account: {
        ...account,
        balance,
        equity: balance + 12,
        margin: 0,
        freeMargin: balance,
        marginLevel: 0,
      },
    },
  };

  const cashOp: StoryStep = {
    label: "cash_op",
    payload: {
      schemaVersion: 1,
      eventId: `fake:${pos}:cash:${pos}`,
      type: "cash_op",
      sentAtUtc: t0,
      account: {
        ...account,
        balance: balance + 250,
        equity: balance + 250,
        margin: 0,
        freeMargin: balance + 250,
        marginLevel: 0,
      },
      deal: {
        dealId: 990_000_000 + (pos % 100_000),
        orderId: pos,
        entry: "in",
        price: 0,
        volume: 0,
        profit: 250,
        commission: 0,
        swap: 0,
        fee: 0,
        timeUtc: t0,
        reason: "other",
      },
    },
  };

  return [
    { label: "deal_open", payload: openPayload },
    { label: "position_modify", payload: modifyPayload },
    closePart(11, 0.04, entryBase + 4.6, 17.2, 1500, "client"),
    closePart(12, 0.06, entryBase + 10.5, 23.3, 2400, "tp"),
    heartbeat,
    cashOp,
  ];
}

async function post(url: string, key: string, payload: unknown): Promise<{ status: number; body: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.text() };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const t0 = Math.floor(Date.now() / 1000) - 3600;
  const story = buildStory(args, t0);
  const steps =
    args.type === "full" ? story : story.filter((step) => step.label === args.type);

  let failures = 0;
  for (const step of steps) {
    const { status, body } = await post(args.url, args.key, step.payload);
    console.log(`${step.label.padEnd(16)} -> ${status} ${body}`);
    if (status !== 200) failures++;
  }
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error("fake-event run failed:", err);
  process.exit(1);
});
