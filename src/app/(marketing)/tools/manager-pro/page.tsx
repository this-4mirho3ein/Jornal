import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Binary,
  Download,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "J-ManagerPro V7 — Money Management EA for MetaTrader 5",
  description:
    "A standalone, pre-compiled money-management Expert Advisor for MetaTrader 5 by the Trading Journal's author. Not connected to the journal in any way — download the .ex5, drop it into MQL5/Experts, and attach it to a chart.",
  alternates: { canonical: "/tools/manager-pro" },
};

const DOWNLOAD = "/download/J-ManagerPro-V7.ex5";

/** Ship facts — surfaced so downloaders can verify what they got. */
const FILE = {
  name: "J-ManagerPro-V7.ex5",
  version: "V7",
  format: ".ex5 (pre-compiled — no MetaEditor needed)",
  size: "132.6 KB",
  sha256: "a08f2ce220517d47b76cb722ef9282012385b95ffea440918257fdf28b20f261",
  updated: "2026-11-09",
  origin: new URL(DOWNLOAD, siteUrl()).toString(),
} as const;

const STEPS = [
  {
    title: "Download the .ex5",
    body: "Use the button above. Browsers may warn about executable files from any site — the SHA-256 above lets you verify the file is exactly the one published here.",
  },
  {
    title: "Open your terminal's data folder",
    body: "In MetaTrader 5: File → Open Data Folder → open MQL5 → Experts. Drop the file in there (keep its name), then restart MT5 or right-click the Navigator → Refresh.",
  },
  {
    title: "Attach to a chart",
    body: "Drag Expert Advisors → J-ManagerPro-V7 from the Navigator onto the chart of the account you want it to manage. Configure its inputs in the dialog that opens.",
  },
  {
    title: "Enable algo trading",
    body: "Tick “Allow algorithmic trading”, make sure the Algo Trading toolbar button is on/green, and confirm the EA's smiling (managed) state in the chart's top-right corner.",
  },
] as const;

export default function ManagerProPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b">
        <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:py-20">
          <p className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            <Binary className="size-3.5 text-profit" aria-hidden="true" />
            Standalone MetaTrader 5 Expert Advisor · Money management
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            J-ManagerPro V7
          </h1>
          <p className="mt-4 max-w-prose text-base text-pretty text-muted-foreground sm:text-lg">
            A <strong>money-management Expert Advisor</strong> for MetaTrader 5 desktop,
            published here by the journal’s author as a separate, standalone tool. It
            ships as a compiled{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.ex5</code>{" "}
            — copy it in, attach it, and it runs; no compiler required.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              {/* `download` forces a save-as; the browser never tries to run it */}
              <a href={DOWNLOAD} download={FILE.name}>
                <Download className="mr-1 inline size-4" aria-hidden="true" />
                Download J-ManagerPro V7
              </a>
            </Button>
            <span className="text-xs text-muted-foreground">
              {FILE.size} · verified SHA-256 below
            </span>
          </div>
        </div>
      </section>

      {/* What it is / is not */}
      <section className="bg-muted/30">
        <div className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-10 sm:py-12">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-profit" aria-hidden="true" />
              <h2 className="text-sm font-semibold">What it is</h2>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              A money-management EA that runs{" "}
              <strong>inside your own MT5 terminal</strong>. You attach it to a chart of
              your account, set its inputs, and it manages that account’s positions
              according to its money-management rules while you trade or run other EAs.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <TriangleAlert
                className="size-5 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <h2 className="text-sm font-semibold">
                What it is not — read this first
              </h2>
            </div>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>
                <strong>It is not part of the Trading Journal</strong> — this is a
                separate product by the same author. Your journal account, trades and
                plans are entirely independent of it.
              </li>
              <li>
                It does <strong>not connect to this website at all</strong>: it needs no
                account here, no ingest key, and does not post anything to the journal.
                The journal’s ingest endpoint only accepts keys created on the Accounts
                page — this tool is not wired to it.
              </li>
              <li>
                It is not an investment service or advice. Money management reduces, but
                never removes, trading risk — always test on a demo account first and
                use live risk you can afford.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Install */}
      <section>
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            Install in MetaTrader 5 — about two minutes
          </h2>
          <ol className="mt-8 grid gap-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-profit/10 text-sm font-semibold text-profit tabular-nums">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-semibold sm:text-base">{step.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            Unlike the journal’s JournalSync EA, this tool does not require adding this
            site to MT5’s WebRequest whitelist — it is not wired to this website.
          </p>
        </div>
      </section>

      {/* File card */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
          <div className="flex items-center gap-3">
            <BadgeCheck className="size-5 text-profit" aria-hidden="true" />
            <h2 className="text-2xl font-semibold tracking-tight">
              File details &amp; integrity
            </h2>
          </div>
          <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
            <dl className="divide-y text-sm">
              {[
                ["File", FILE.name],
                ["Version", FILE.version],
                ["Format", FILE.format],
                ["Size", FILE.size],
                ["Updated", FILE.updated],
                ["Direct link", FILE.origin],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-baseline sm:gap-4"
                >
                  <dt className="w-24 shrink-0 text-xs tracking-wide text-muted-foreground uppercase">
                    {label}
                  </dt>
                  <dd className="min-w-0 font-mono text-xs break-words">{value}</dd>
                </div>
              ))}
              <div className="bg-muted/40 px-5 py-3">
                <dt className="w-24 shrink-0 text-xs tracking-wide text-muted-foreground uppercase">
                  SHA-256
                </dt>
                <dd className="mt-1 font-mono text-xs break-all select-all">
                  {FILE.sha256}
                </dd>
              </div>
            </dl>
            <p className="border-t px-5 py-3 text-xs leading-relaxed text-muted-foreground">
              Verify after download (
              <code className="font-mono">shasum -a 256 J-ManagerPro-V7.ex5</code> or{" "}
              <code className="font-mono">
                certutil -hashfile J-ManagerPro-V7.ex5 SHA256
              </code>
              ) — it must match exactly. The file is served as-is from this site over
              HTTPS.
            </p>
          </div>
        </div>
      </section>

      {/* Risk disclaimer */}
      <section>
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
            <div className="flex items-start gap-2">
              <ShieldAlert
                className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Trade responsibly
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                  Trading leveraged instruments involves substantial risk of loss.
                  J-ManagerPro V7 is a tool, not a guarantee — run it on a demo account
                  until you understand exactly what it does with your positions, and
                  never risk money you cannot afford to lose. Nothing on this page is
                  investment advice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Back to journal */}
      <section className="border-t">
        <div className="mx-auto w-full max-w-3xl px-4 py-14 text-center sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">
            Want the journal too?
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-muted-foreground">
            The Trading Journal is this site’s main product: a realtime, private MT5
            trade journal with analytics. Setting it up takes about five minutes.
          </p>
          <Button asChild size="lg" variant="outline" className="mt-6">
            <Link href="/guide">Set up the Trading Journal</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
