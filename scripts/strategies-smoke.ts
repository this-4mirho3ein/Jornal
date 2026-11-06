/**
 * strategies-smoke.ts — task 07 verification (spec §5.1.7 end-to-end).
 *
 *   pnpm tsx scripts/strategies-smoke.ts --mode setup --key <INGEST_KEY> \
 *     [--url http://localhost:3000/api/ingest] [--magic 1001] [--posId 777009123]
 *
 * setup  → upserts the smoke strategy (code SMOKE-TEST) and the
 *          magic→strategy row for the account that owns the ingest key.
 *          Then POST a full fake lifecycle (scripts/send-fake-event.ts) whose
 *          events carry magic: 1001.
 * verify → asserts the resulting trade row got auto-assigned that strategy
 *          through the REAL ingest pipeline, prints PASS/FAIL, and always
 *          cleans its artifacts (trade, mapping, strategy) so the journal
 *          stays pristine.
 */
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";

import "@/lib/load-env";

import { db } from "@/db/client";
import {
  magicStrategyMap,
  strategies,
  trades,
  tradingAccounts,
} from "@/db/schema";

interface Args {
  mode: "setup" | "verify";
  key: string;
  magic: number;
  posId: number;
  url: string;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    mode: "setup",
    key: "",
    magic: 1001,
    posId: 777_009_123,
    url: "http://localhost:3000",
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1] ?? "";
    if (flag === "--mode") { args.mode = value === "verify" ? "verify" : "setup"; i++; }
    else if (flag === "--key") { args.key = value.trim(); i++; }
    else if (flag === "--magic") { args.magic = Number(value); i++; }
    else if (flag === "--posId") { args.posId = Number(value); i++; }
    else if (flag === "--url") { args.url = value; i++; }
  }
  if (!args.key) {
    console.error("missing --key (the account ingest key)");
    process.exit(2);
  }
  return args;
}

const SMOKE_CODE = "SMOKE-TEST";

async function findAccountByKey(key: string) {
  const hash = createHash("sha256").update(key).digest("hex");
  const rows = await db
    .select()
    .from(tradingAccounts)
    .where(eq(tradingAccounts.ingestKeyHash, hash))
    .limit(1);
  if (rows.length === 0) {
    throw new Error("No trading account matches this ingest key — is it still valid?");
  }
  return rows[0];
}

async function setup(args: Args): Promise<void> {
  const account = await findAccountByKey(args.key);
  const [strategy] = await db
    .insert(strategies)
    .values({
      userId: account.userId,
      name: "Smoke Strategy",
      code: SMOKE_CODE,
      description: "Created by scripts/strategies-smoke.ts — deleted again by --mode verify.",
    })
    .onConflictDoUpdate({
      target: [strategies.userId, strategies.code],
      set: { archivedAt: null },
    })
    .returning();
  await db
    .insert(magicStrategyMap)
    .values({ accountId: account.id, magic: args.magic, strategyId: strategy.id })
    .onConflictDoUpdate({
      target: [magicStrategyMap.accountId, magicStrategyMap.magic],
      set: { strategyId: strategy.id },
    });
  console.log(`= setup ok: magic ${args.magic} → strategy ${SMOKE_CODE} (${strategy.id})`);
}

async function cleanup(accountId: string, userId: string, posId: number): Promise<void> {
  await db
    .delete(trades)
    .where(and(eq(trades.accountId, accountId), eq(trades.positionId, posId)));
  await db
    .delete(magicStrategyMap)
    .where(eq(magicStrategyMap.accountId, accountId));
  await db
    .delete(strategies)
    .where(and(eq(strategies.userId, userId), eq(strategies.code, SMOKE_CODE)));
}

async function verify(args: Args): Promise<void> {
  const account = await findAccountByKey(args.key);
  try {
    const rows = await db
      .select({
        id: trades.id,
        strategyId: trades.strategyId,
        style: trades.style,
        status: trades.status,
        netProfit: trades.netProfit,
      })
      .from(trades)
      .where(and(eq(trades.accountId, account.id), eq(trades.positionId, args.posId)))
      .limit(1);
    if (rows.length === 0) {
      throw new Error(
        `No trade found for position ${args.posId} — did the fake event POST succeed?`,
      );
    }
    const trade = rows[0];
    const expected = await db
      .select({ id: strategies.id })
      .from(strategies)
      .where(and(eq(strategies.userId, account.userId), eq(strategies.code, SMOKE_CODE)))
      .limit(1);
    const assigned = expected.length > 0 && trade.strategyId === expected[0].id;
    console.log(
      `= trade ${trade.id}: status=${trade.status} style=${trade.style} ` +
        `net=${trade.netProfit} strategyId=${trade.strategyId}`,
    );
    if (!assigned) {
      throw new Error(
        `FAIL: strategy was NOT auto-assigned via magic ${args.magic} ` +
          `(expected ${expected[0]?.id ?? "<missing smoke strategy>"})`,
      );
    }
    console.log("PASS: ingest auto-assigned the strategy from the magic map (§5.1.7).");
  } finally {
    await cleanup(account.id, account.userId, args.posId);
    console.log("= cleanup ok: smoke trade, mapping and strategy removed");
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "setup") await setup(args);
  else await verify(args);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
