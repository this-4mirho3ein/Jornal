#!/usr/bin/env node
/**
 * Syncs the single source of truth `mt5/JournalSync.mq5` (spec §6 deliverable)
 * into `public/download/JournalSync.mq5` so website visitors can download the
 * Expert Advisor from the setup guide (/guide). The public copy is a derived
 * build artifact — it is gitignored and regenerated on every `pnpm dev` and
 * `pnpm build` (chained explicitly in package.json rather than as a pre/post
 * lifecycle hook, so the copy runs under any pnpm client settings).
 */
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "mt5", "JournalSync.mq5");
const target = join(root, "public", "download", "JournalSync.mq5");

try {
  const { size } = await stat(source);
  if (size < 1024) {
    throw new Error(`source looks truncated (${size} bytes)`);
  }
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  console.log(`[copy-ea] JournalSync.mq5 → public/download/ (${size} bytes)`);
} catch (err) {
  console.error(
    `[copy-ea] FAILED: ${err instanceof Error ? err.message : String(err)}\n` +
      `Expected the EA at mt5/JournalSync.mq5 — cannot publish /download/JournalSync.mq5.`,
  );
  process.exit(1);
}
