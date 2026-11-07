/**
 * mt5-bridge.ts — drains the EA's on-disk queue into /api/ingest (ADR 0008).
 *
 * On mac/Wine hosts the MT5 Options dialog cannot reliably arm the WebRequest
 * whitelist (the OK button never applies in-memory, so the EA logs 4014
 * forever). With the EA's `InpBridgeMode=true` it ONLY appends JSONL events
 * to MQL5/Files/journal_queue.jsonl; this process hands them to the API.
 *
 * Safety model (matches the EA's own semantics, spec §0.8 idempotency):
 *   - batch = atomic rename of the live queue file; events the EA appends
 *     during processing stay in a fresh journal_queue.jsonl;
 *   - 2xx (incl. {"duplicate":true}) and poison 4xx (except 408/429/5xx)
 *     are consumed; everything else is re-appended to the live file in
 *     order, so the next cycle retries;
 *   - a truncated trailing line (EA mid-write) is never posted — it is
 *     re-appended and completed by the EA.
 *
 * Usage:
 *   pnpm tsx scripts/mt5-bridge.ts --key <INGEST_KEY> \
 *     [--url http://localhost:3000/api/ingest] \
 *     [--files <path to MQL5/Files>] [--interval 2000]
 * `--key` may be omitted when /tmp/ingest-key.txt exists.
 * Stop with Ctrl+C — unprocessed lines are always returned to the file.
 */
import { readFile, rename, unlink, access, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { createHash } from "node:crypto";

import "@/lib/load-env"; // not strictly required here, keeps tsx config parity

interface Args {
  url: string;
  key: string;
  files: string;
  intervalMs: number;
}

const DEFAULT_FILES = join(
  homedir(),
  "Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Files",
);

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    url: "http://localhost:3000/api/ingest",
    key: "",
    files: DEFAULT_FILES,
    intervalMs: 2000,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1] ?? "";
    if (flag === "--url") { args.url = value; i++; }
    else if (flag === "--key") { args.key = value.trim(); i++; }
    else if (flag === "--files") { args.files = value.replace(/^~/, homedir()); i++; }
    else if (flag === "--interval") { args.intervalMs = Math.max(500, Number(value) || 2000); i++; }
  }
  return args;
}

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

async function postEvent(url: string, key: string, line: string): Promise<number> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: line,
  });
  await res.arrayBuffer(); // drain
  return res.status;
}

/** 2xx and poison-4xx are consumed, matching the EA's FlushQueue rules. */
function isConsumed(code: number): boolean {
  return (code >= 200 && code < 300) || (code >= 400 && code < 500 && code !== 408 && code !== 429);
}

const QUEUE = "journal_queue.jsonl";

async function drainOnce(args: Args): Promise<void> {
  const livePath = join(args.files, QUEUE);
  const batchPath = join(args.files, `.bridge-batch.${process.pid}.jsonl`);
  // Atomic hand-off: the EA keeps appending to a fresh live file afterwards.
  try {
    await rename(livePath, batchPath);
  } catch {
    return; // nothing to drain
  }
  const raw = await readFile(batchPath, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 2);
  const pending: string[] = [];
  let sent = 0;
  let duplicates = 0;
  for (const line of lines) {
    // Only complete JSON objects are posted; a truncated tail (EA mid-write
    // during the rename) cycles back into the live file untouched.
    if (!(line.trimStart().startsWith("{") && line.trimEnd().endsWith("}"))) {
      pending.push(line);
      continue;
    }
    try {
      const code = await postEvent(args.url, args.key, line);
      if (isConsumed(code)) {
        if (code >= 400) console.log(`bridge: server rejected event (HTTP ${code}) — dropped as poison`);
        else duplicates++;
        sent++;
      } else {
        console.log(`bridge: retrying later (HTTP ${code})`);
        pending.push(line);
        break; // keep order: stop at first failure
      }
    } catch (error) {
      console.log(`bridge: network error (${error instanceof Error ? error.message : String(error)})`);
      pending.push(line);
      break;
    }
  }
  if (pending.length > 0) {
    // Return everything not yet accepted in order, ahead of any new events
    // the EA appended while we were processing the batch (writeFile, not
    // append — the remainder must land BEFORE the newer lines).
    const current = (await exists(livePath)) ? await readFile(livePath, "utf8") : "";
    const restored = [...pending, ""].join("\n") + current;
    await writeFile(livePath, restored, "utf8");
  }
  if (sent > 0) {
    console.log(
      `bridge: forwarded ${sent} event(s)` + (duplicates > 0 ? ` (${duplicates} already known)` : "") +
        (pending.length > 0 ? `, ${pending.length} waiting` : ""),
    );
  }
  await unlink(batchPath).catch(() => {});
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.key) {
    const keyFile = "/tmp/ingest-key.txt";
    if (await exists(keyFile)) args.key = (await readFile(keyFile, "utf8")).trim();
  }
  if (args.key.length < 10) {
    console.error("bridge: no --key and no /tmp/ingest-key.txt — refusing to start");
    process.exit(2);
  }
  console.log(
    `bridge: draining ${join(args.files, QUEUE)} -> ${args.url} every ${args.intervalMs}ms`,
  );
  console.log(`bridge: key=${createHash("sha256").update(args.key).digest("hex").slice(0, 8)}… (fingerprint only)`);
  const tick = async (): Promise<void> => {
    try {
      await drainOnce(args);
    } catch (error) {
      console.log(`bridge: cycle error (${error instanceof Error ? error.message : String(error)})`);
    }
  };
  for (;;) {
    await tick();
    await new Promise((r) => setTimeout(r, args.intervalMs));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
