import "@/lib/load-env";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import {
  balanceSnapshots,
  cashOperations,
  magicStrategyMap,
  strategies,
  tradeDeals,
  tradeEvents,
  tradingAccounts,
  trades,
  users,
} from "./schema";
import {
  aggregateTrade,
  buildTrade,
  mulberry32,
  type PlanContext,
  type TradePlan,
} from "./seed-plan";

/**
 * Deterministic seed (task 02): demo user, 2 accounts, ~40 realistic trades
 * (unassigned strategies — mocks no longer seeded), balance snapshots, cash
 * ops. Re-running resets and re-creates the same data (fixed UUIDs + RNG seed).
 */

const SEED_USER_ID = "00000000-0000-4000-8000-000000000001";
const LIVE_ACCOUNT_ID = "00000000-0000-4000-8000-000000000002";
const DEMO_ACCOUNT_ID = "00000000-0000-4000-8000-000000000003";

const SETUPS = ["OB", "FVG", "SSL", "BSL", "Liquidity sweep", "Breaker"];
const MISTAKES = ["moved SL", "no confirmation", "revenge", "early entry", "oversize"];
const EMOTIONS = [
  "confident",
  "neutral",
  "uncertain",
  "fear",
  "greed",
  "fomo",
  "revenge",
] as const;

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required for seeding");
  const useSsl =
    url.includes("localhost") || url.includes("127.0.0.1")
      ? undefined
      : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString: url, ssl: useSsl });
  const db = drizzle(pool);

  // ---- Resolve the owner user ----------------------------------------------
  // Demo data attaches to the real authenticated owner when one exists
  // (matched via OWNER_EMAIL), so `pnpm dev` shows journal data after login.
  // The owner's auth rows (sessions/credential account) are never deleted;
  // only the fixed-uuid demo user from a previous seed run is reset.
  const ownerEmail = process.env.OWNER_EMAIL ?? "owner@journal.local";
  const existingOwner = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, ownerEmail))
      .limit(1)
  )[0];
  const ownerId = existingOwner?.id ?? SEED_USER_ID;
  await db.delete(users).where(eq(users.id, SEED_USER_ID));
  if (!existingOwner) {
    await db
      .insert(users)
      .values({ id: SEED_USER_ID, email: ownerEmail, name: "Journal Owner" });
  }

  // ---- Reset domain rows ----------------------------------------------------
  // Fixed demo ids make re-running safe only if prior demo rows are wiped
  // first (§0.8 idempotency); FK order: children before parents.
  await db.delete(tradeDeals);
  await db.delete(tradeEvents);
  await db.delete(balanceSnapshots);
  await db.delete(cashOperations);
  await db.delete(trades);
  await db.delete(magicStrategyMap);
  await db.delete(strategies);
  await db.delete(tradingAccounts);

  await db.insert(tradingAccounts).values([
    {
      id: LIVE_ACCOUNT_ID,
      userId: ownerId,
      displayName: "Prop Firm 100K",
      login: 51234567,
      server: "ICMarketsSC-MT5",
      broker: "Raw Trading Ltd",
      currency: "USD",
      isDemo: false,
      ingestKeyHash: "seed-hash-live",
      ingestKeyPrefix: "seedli",
      lastSeenAt: new Date(),
      lastBalance: "100000.00",
      lastEquity: "100000.00",
    },
    {
      id: DEMO_ACCOUNT_ID,
      userId: ownerId,
      displayName: "Strategy Lab (Demo)",
      login: 20987654,
      server: "MetaQuotes-Demo",
      broker: "MetaQuotes Software Corp.",
      currency: "USD",
      isDemo: true,
      ingestKeyHash: "seed-hash-demo",
      ingestKeyPrefix: "seedde",
      lastSeenAt: new Date(),
      lastBalance: "5000.00",
      lastEquity: "5000.00",
    },
  ]);

  // ---- Trades --------------------------------------------------------------
  const balances: Record<string, number> = {
    [LIVE_ACCOUNT_ID]: 100000,
    [DEMO_ACCOUNT_ID]: 5000,
  };
  const nowMs = Date.now();
  const start = new Date(nowMs - 21 * 24 * 60 * 60 * 1000);
  const ctx: PlanContext = { rand: mulberry32(42), nowMs };

  const plans: TradePlan[] = [];
  let positionId = 900000001;
  for (let i = 0; i < 40; i++) {
    let when = new Date(
      start.getTime() + (i / 40) * 20 * 86400000 + ctx.rand() * 4 * 3600000,
    );
    if (when.getUTCDay() === 6) when = new Date(when.getTime() + 2 * 86400000);
    if (when.getUTCDay() === 0) when = new Date(when.getTime() + 1 * 86400000);
    const accountId = ctx.rand() < 0.7 ? LIVE_ACCOUNT_ID : DEMO_ACCOUNT_ID;
    plans.push(buildTrade(ctx, accountId, positionId, when));
    positionId += 1;
  }
  plans.sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());

  let dealCounter = 100000001;
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(ctx.rand() * arr.length)];

  for (const plan of plans) {
    const agg = aggregateTrade(plan);
    const balanceAtOpen = balances[plan.accountId];
    const isClosed = plan.closedAt !== null;
    if (isClosed) {
      balances[plan.accountId] = Number(
        (balances[plan.accountId] + Number(agg.netProfit)).toFixed(2),
      );
    }

    const lastDeal = plan.deals[plan.deals.length - 1];
    const inserted = await db
      .insert(trades)
      .values({
        accountId: plan.accountId,
        positionId: plan.positionId,
        symbol: plan.symbolKey,
        direction: plan.direction,
        status: isClosed ? "closed" : "open",
        openedAt: plan.openedAt,
        closedAt: plan.closedAt,
        volumeOpened: agg.volumeOpened,
        volumeClosed: agg.volumeClosed,
        avgEntryPrice: agg.avgEntryPrice,
        avgExitPrice: agg.avgExitPrice,
        sl: agg.initialSl,
        tp: agg.initialTp,
        initialSl: agg.initialSl,
        initialTp: agg.initialTp,
        grossProfit: agg.grossProfit,
        commission: agg.commission,
        swap: agg.swap,
        fee: agg.fee,
        netProfit: agg.netProfit,
        balanceAtOpen: balanceAtOpen.toFixed(2),
        balanceAtClose: isClosed ? balances[plan.accountId].toFixed(2) : null,
        riskAmount: agg.riskAmount,
        rMultiple: agg.rMultiple,
        pipsOrPoints: agg.pipsOrPoints,
        durationSeconds: agg.durationSeconds,
        strategyId: null,
        style: agg.style,
        styleSource: "auto",
        mt5Comment: plan.comment,
        mt5Magic: plan.magic,
        rating: isClosed && ctx.rand() < 0.5 ? Math.ceil(ctx.rand() * 5) : null,
        emotion: isClosed && ctx.rand() < 0.5 ? pick(EMOTIONS) : null,
        setupTags: ctx.rand() < 0.6 ? [pick(SETUPS)] : [],
        mistakeTags:
          isClosed && Number(agg.netProfit) < 0 && ctx.rand() < 0.5
            ? [pick(MISTAKES)]
            : [],
        closeReason: isClosed ? lastDeal.reason : null,
      })
      .returning({ id: trades.id });

    const tradeId = inserted[0].id;

    await db.insert(tradeDeals).values(
      plan.deals.map((d, i) => ({
        tradeId,
        accountId: plan.accountId,
        dealId: dealCounter + i,
        orderId: d.orderId,
        entry: d.entry,
        price: d.price,
        volume: d.volume,
        profit: d.profit,
        commission: d.commission,
        swap: d.swap,
        fee: "0.00",
        timeUtc: d.timeUtc,
        reason: d.reason,
      })),
    );
    dealCounter += plan.deals.length;

    if (isClosed) {
      const closedAt = plan.closedAt as Date;
      await db.insert(balanceSnapshots).values({
        accountId: plan.accountId,
        balance: balances[plan.accountId].toFixed(2),
        equity: balances[plan.accountId].toFixed(2),
        margin: "0.00",
        recordedAt: closedAt,
      });
    }

    await db.insert(tradeEvents).values({
      accountId: plan.accountId,
      eventId: `deal:seed-${plan.positionId}`,
      type: isClosed ? "deal_close" : "deal_open",
      payload: { seeded: true, positionId: plan.positionId },
    });
  }

  // ---- Cash operations (excluded from trade PnL, visible in balance) --------
  await db.insert(cashOperations).values([
    {
      accountId: LIVE_ACCOUNT_ID,
      dealId: 800000001,
      amount: "20000.00",
      type: "deposit",
      comment: "Prop challenge phase 2 top-up",
      timeUtc: new Date(start.getTime() + 5 * 86400000),
    },
    {
      accountId: DEMO_ACCOUNT_ID,
      dealId: 800000002,
      amount: "-1000.00",
      type: "withdrawal",
      comment: "Demo reset withdrawal",
      timeUtc: new Date(start.getTime() + 10 * 86400000),
    },
  ]);

  const closedCount = plans.filter((p) => p.closedAt !== null).length;
  console.log(
    `Seeded: ${plans.length} trades (${closedCount} closed), 4 strategies, 2 accounts.`,
  );
  await pool.end();
}

main().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
