import { existsSync } from "node:fs";
import { join } from "node:path";

import type { Metadata } from "next";
import Link from "next/link";
import {
  AlarmClock,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Download,
  KeyRound,
  MonitorSmartphone,
  Puzzle,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Connect MetaTrader 5",
  description:
    "Download the JournalSync Expert Advisor and connect MetaTrader 5 to your trading journal in about five minutes: allow WebRequest, paste your ingest key, and your deals — including the last 90 days — stream in automatically.",
  alternates: { canonical: "/guide" },
};

/** Rendered from the real deployment origin so the copy-paste value is always live-correct. */
const ORIGIN = siteUrl().origin;
const INGEST_URL = `${ORIGIN}/api/ingest`;
const EA_DOWNLOAD = "/download/JournalSync.mq5";

/**
 * The compiled Expert Advisor exists once the Compile EA workflow has run on
 * a Windows runner (the MQL5 compiler is proprietary Windows tooling). When
 * present at build time, the .ex5 becomes the primary download and users can
 * skip MetaEditor entirely; the .mq5 source stays available either way.
 */
const EA_COMPILED = "/download/JournalSync.ex5";
const EA_COMPILED_EXISTS = existsSync(join(process.cwd(), "public", EA_COMPILED));

/** Optional EA inputs (mt5/README.md §1) — defaults shown are v1.01 zero-config defaults. */
const EA_INPUTS = [
  {
    name: "InpApiUrl",
    def: "—",
    text: "Journal ingest endpoint. Empty = MQL5/Files/journal_url.txt when present, else the local journal. Set this for the live site, or put the URL (one line) in journal_url.txt.",
  },
  {
    name: "InpApiKey",
    def: "—",
    text: "Your per-account ingest key from the Accounts page. Empty = MQL5/Files/journal_key.txt (one line). The file is the safer home — it lives only in this terminal's data folder and never syncs with the repo.",
  },
  {
    name: "InpBackfillDays",
    def: "90",
    text: "On attach, re-sends your closed deals of the last N days once. The server dedupes replays, so your history imports safely and repair runs stay harmless. 0 disables.",
  },
  {
    name: "InpHeartbeatSec",
    def: "60",
    text: "Heartbeat + queue-flush cadence in seconds — powers the dashboard's Connected/Offline badge and equity snapshots.",
  },
  {
    name: "InpTimeoutMs",
    def: "8000",
    text: "WebRequest timeout in milliseconds. Leave the default unless your network is slow.",
  },
  {
    name: "InpVerbose",
    def: "true",
    text: "Logs every HTTP status and queue flush to the Experts tab — keep it on while setting up.",
  },
] as const;

/** Troubleshooting rows lifted from mt5/README.md §6 — details/summary stays zero-JS. */
const TROUBLESHOOTING = [
  {
    q: "Experts log shows “WebRequest error 4060” or “4014”",
    a: "WebRequest is not allowed yet: MT5 desktop → Tools → Options → Expert Advisors → tick “Allow WebRequest for listed URL”, add the journal origin, then fully restart MT5 (the option only arms on restart — under Wine/PlayOnMac this dialog may not save at all; see the Mac note below).",
  },
  {
    q: "I whitelisted the URL but still get 4060",
    a: "The whitelist stores origins only — https://your-domain.vercel.app with no /path — and http vs https are different origins. Make sure the entry matches this exact origin character-for-character and restart the terminal.",
  },
  {
    q: "The Experts log replies HTTP 401",
    a: "The ingest key is wrong, was rotated, or belongs to a different account. Re-copy the current key from the journal's Accounts page (`tj_…`) into journal_key.txt or the InpApiKey input, then re-attach the EA. (429 instead of 401 means you hit the rate limit — retry after a minute.)",
  },
  {
    q: "Alert: “no ingest key — put it in MQL5\\Files\\journal_key.txt or fill InpApiKey”",
    a: "The key file is missing and the input is empty. Copy the key from the Accounts page into MQL5/Files/journal_key.txt (one line, no spaces) or paste it into the InpApiKey input, then re-attach.",
  },
  {
    q: "No trades appear even though the EA is attached",
    a: "Check, in order: Algo Trading is enabled (toolbar button + “Allow algorithmic trading”), the EA is attached to only ONE chart of that account, the key/URL inputs are set, and the Experts tab shows JournalSync activity with InpVerbose on. The journal only shows the account the key belongs to — make sure it's selected in the account switcher.",
  },
  {
    q: "journal_queue.jsonl keeps growing in MQL5/Files",
    a: "That is the EA working as designed: the site was unreachable (or replied 5xx), so events are safe on an on-disk queue and flush in order the moment connectivity returns. Check that this origin is reachable and whitelisted; nothing needs re-entering and no deals are lost.",
  },
  {
    q: "Will restarting MT5 create duplicate trades?",
    a: 'No. Event ids are deterministic (`deal:<ticket>`, epoch-second heartbeats) and the server dedupes replays — backfills, restarts and retry storms all collapse into the same trades ({"duplicate":true}).',
  },
] as const;

function StepHeader({ index, title }: { index: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-profit/10 text-sm font-semibold text-profit tabular-nums">
        {index}
      </span>
      <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
    </div>
  );
}

/** Inline whitespace-pre code row with a copy affordance (origin / ingest URL). */
function CodeRow({
  value,
  "aria-label": ariaLabel,
}: {
  value: string;
  "aria-label"?: string;
}) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/40 py-1.5 pr-1.5 pl-3">
      <code
        className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap select-all"
        aria-label={ariaLabel}
      >
        {value}
      </code>
      <CopyButton value={value} size="sm" variant="ghost" />
    </div>
  );
}

export default function SetupGuidePage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b">
        <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:py-20">
          <p className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            <BookOpen className="size-3.5 text-profit" aria-hidden="true" />
            Setup tutorial · about 5 minutes, once
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Connect MetaTrader 5 to your journal
          </h1>
          <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
            Install the <strong>JournalSync</strong> Expert Advisor in your MT5 desktop
            terminal and every deal streams to your journal in realtime — open, close,
            partial exits, SL/TP changes and cash operations. On first attach it also
            imports your <strong>last 90 days</strong> of closed deals automatically.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {EA_COMPILED_EXISTS ? (
              <>
                <Button asChild size="lg">
                  {/* `download` forces a save-as instead of rendering in the tab */}
                  <a href={EA_COMPILED} download="JournalSync.ex5">
                    <Download className="mr-1 inline size-4" aria-hidden="true" />
                    Download for MetaTrader 5
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/register">Create a free account</Link>
                </Button>
                <a
                  href={EA_DOWNLOAD}
                  download="JournalSync.mq5"
                  className="basis-full text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground sm:basis-auto"
                >
                  Advanced: download the .mq5 source instead
                </a>
              </>
            ) : (
              <>
                <Button asChild size="lg">
                  {/* `download` forces a save-as instead of rendering MQL5 source in the tab */}
                  <a href={EA_DOWNLOAD} download="JournalSync.mq5">
                    <Download className="mr-1 inline size-4" aria-hidden="true" />
                    Download JournalSync.mq5
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/register">Create a free account</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* The road: three stages from zero to live trades */}
      <section aria-label="The road to your first synced trade" className="border-b">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
          <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0">
            {[
              {
                icon: UserRound,
                title: "Create your journal account",
                meta: "1 minute, free",
              },
              {
                icon: KeyRound,
                title: "Get your ingest key",
                meta: "Accounts → New account",
              },
              {
                icon: Puzzle,
                title: "Install the EA in MT5",
                meta: "detailed below — the only real work",
              },
            ].map(({ icon: Icon, title, meta }, index) => (
              <li key={title} className="flex min-w-0 flex-1 items-center gap-2">
                <div className="min-w-0 flex-1 rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-profit/10 text-profit">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                      0{index + 1}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-snug font-medium">{title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
                </div>
                {index < 2 ? (
                  <ChevronRight
                    className="hidden size-4 shrink-0 text-muted-foreground sm:block"
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Before you start */}
      <section className="bg-muted/30">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-12">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <MonitorSmartphone className="size-5 text-profit" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold">
                You need MT5{" "}
                <em className="not-italic underline decoration-border decoration-2 underline-offset-2">
                  desktop
                </em>
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                The MetaTrader 5{" "}
                <strong>web terminal in a browser cannot run Expert Advisors</strong> —
                this is a platform limit, not ours. On Mac, run the desktop terminal via
                PlayOnMac/Wine/CrossOver (MetaQuotes ships a PlayOnMac installer); on
                iPhone/Android use the desktop terminal on any machine — even once, at
                setup.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <ShieldCheck className="size-5 text-profit" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold">
                Your journal account + ingest key
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                The key only lets MT5 <strong>write trade events</strong> for its one
                account — it can never read your data, and it is shown{" "}
                <strong>only once</strong> when created. Traffic is HTTPS and goes only
                to origins you whitelist in MT5.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section>
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
          <h2 className="sr-only">Setup steps</h2>
          <ol className="grid gap-4">
            <li className="rounded-xl border bg-card p-5 shadow-sm">
              <StepHeader
                index={1}
                title="Create the account and copy your ingest key"
              />
              <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>Everything below happens on this site — under two minutes:</p>
                <ol className="ml-4 list-decimal space-y-1.5">
                  <li>
                    No account yet?{" "}
                    <Link
                      href="/register"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      Register free
                    </Link>{" "}
                    (or{" "}
                    <Link
                      href="/login"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      sign in
                    </Link>
                    ).
                  </li>
                  <li>
                    Open <strong>Accounts</strong> and press <em>New account</em>.
                  </li>
                  <li>
                    Fill in what you know — display name, broker, MT5 login and server,
                    exactly as MT5 shows them. Everything is optional except the{" "}
                    <strong>Demo</strong> switch; your MT5 login and server also attach
                    themselves automatically on the EA’s first handshake.
                  </li>
                  <li>
                    Press <strong>Create account</strong>. A panel reveals your ingest
                    key (
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                      tj_…
                    </code>
                    ) and <strong>stays open until you close it</strong> — press{" "}
                    <strong>Copy key</strong> first, keep it somewhere safe, then close
                    with <strong>I saved it</strong>.
                  </li>
                </ol>
                <p>
                  Lost or closed the panel? No problem — press <em>Rotate key</em> on
                  the account any time and copy the fresh key the same way (the old key
                  stops working immediately).
                </p>
              </div>
            </li>

            <li className="rounded-xl border bg-card p-5 shadow-sm">
              <StepHeader index={2} title="Install the Expert Advisor into the terminal" />
              <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                {EA_COMPILED_EXISTS ? (
                  <p>
                    Download{" "}
                    <a
                      href={EA_COMPILED}
                      download="JournalSync.ex5"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      JournalSync.ex5
                    </a>{" "}
                    — it comes <strong>pre-compiled and ready to run</strong>, so
                    MetaEditor is not needed at all. (Prefer source? Grab the{" "}
                    <a
                      href={EA_DOWNLOAD}
                      download="JournalSync.mq5"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      JournalSync.mq5
                    </a>{" "}
                    instead and see the compile note in step 4.)
                  </p>
                ) : (
                  <p>
                    Download{" "}
                    <a
                      href={EA_DOWNLOAD}
                      download="JournalSync.mq5"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      JournalSync.mq5
                    </a>{" "}
                    (the file from the button above).
                  </p>
                )}
                <ol className="ml-4 list-decimal space-y-1.5">
                  <li>
                    In MT5: <strong>File → Open Data Folder</strong> → open{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                      MQL5
                    </code>{" "}
                    →{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                      Experts
                    </code>
                    .
                  </li>
                  <li>
                    Copy the {EA_COMPILED_EXISTS ? ".ex5" : ".mq5"} file in there
                    (keep its name).
                  </li>
                </ol>
              </div>
            </li>

            <li className="rounded-xl border bg-card p-5 shadow-sm">
              <StepHeader
                index={3}
                title="Allow WebRequest for this journal's origin"
              />
              <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>
                  MT5 blocks network calls from EAs by default. In MT5 go to{" "}
                  <strong>Tools → Options → Expert Advisors</strong>, tick{" "}
                  <strong>“Allow WebRequest for listed URL”</strong> and add this exact
                  origin (no path, no trailing slash):
                </p>
                <CodeRow
                  value={ORIGIN}
                  aria-label="Journal origin to whitelist in MetaTrader 5"
                />
                <p>
                  Also tick <strong>“Allow algorithmic trading”</strong>, press OK, and{" "}
                  <strong>restart MT5</strong> — the whitelist only arms on restart.
                </p>
              </div>
            </li>

            <li className="rounded-xl border bg-card p-5 shadow-sm">
              <StepHeader
                index={4}
                title={EA_COMPILED_EXISTS ? "Attach to ONE chart" : "Compile, then attach to ONE chart"}
              />
              <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                {EA_COMPILED_EXISTS ? (
                  <p>
                    The <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                      .ex5
                    </code>{" "}
                    you installed is already compiled — no MetaEditor step needed.
                    (If you took the{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                      .mq5
                    </code>{" "}
                    source instead: press <strong>F4</strong> for the MetaQuotes
                    editor, open{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                      JournalSync.mq5
                    </code>{" "}
                    and compile with <strong>F7</strong> — you want{" "}
                    <em className="not-italic">0 errors</em>.)
                  </p>
                ) : (
                  <p>
                    In MT5 press <strong>F4</strong> (or Tools → MetaQuotes Language
                    Editor), open{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                      JournalSync.mq5
                    </code>{" "}
                    from the Navigator’s Experts list and compile with <strong>F7</strong>{" "}
                    — you want <em className="not-italic">0 errors</em> in the output.
                  </p>
                )}
                <p>
                  Back in the terminal, drag{" "}
                  <strong>Expert Advisors → JournalSync</strong> from the Navigator onto{" "}
                  <strong>any one chart</strong> of your account, trading or not. One EA
                  instance receives events for <strong>all symbols</strong> on that
                  account — do not attach it twice. Make sure the{" "}
                  <strong>Algo Trading</strong> toolbar button is green/on.
                </p>
              </div>
            </li>

            <li className="rounded-xl border bg-card p-5 shadow-sm">
              <StepHeader
                index={5}
                title="Point it at your journal (or leave it zero-config)"
              />
              <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>
                  In the EA’s input dialog: paste your ingest key into{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    InpApiKey
                  </code>{" "}
                  and this endpoint into{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    InpApiUrl
                  </code>
                  :
                </p>
                <CodeRow value={INGEST_URL} aria-label="Journal ingest endpoint URL" />
                <p>
                  Prefer files over inputs? Leave both inputs empty and put the key in{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    MQL5/Files/journal_key.txt
                  </code>{" "}
                  and the URL in{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    MQL5/Files/journal_url.txt
                  </code>{" "}
                  (one line each) — then you never touch the inputs again, and the key
                  file stays inside this terminal’s data folder. Inputs override the
                  files.
                </p>
                <p className="text-xs">
                  Optional inputs (defaults are fine):{" "}
                  {EA_INPUTS.map((input, i) => (
                    <span key={input.name}>
                      {i > 0 ? " · " : ""}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                        {input.name}={input.def}
                      </code>
                    </span>
                  ))}
                </p>
              </div>
            </li>

            <li className="rounded-xl border bg-card p-5 shadow-sm">
              <StepHeader index={6} title="Watch your history and live trades arrive" />
              <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Seconds after attach, the <strong>Experts</strong> tab prints the
                  journal URL and only a prefix of your key (the full key never shows in
                  logs), then{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    JournalSync: HTTP 200
                  </code>{" "}
                  lines for every event. The journal’s dashboard <strong>Live</strong>{" "}
                  badge turns green, your last 90 days of closed deals import once
                  (dedupe-safe), and a <strong>demo</strong> trade appears on the
                  dashboard and Trades page in realtime — no refresh.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* Optional inputs reference */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
          <h2 className="text-2xl font-semibold tracking-tight">EA inputs reference</h2>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Every default is production-ready — this table is here so you know what each
            knob does before you touch it.
          </p>
          <dl className="mt-8 grid gap-3">
            {EA_INPUTS.map((input) => (
              <div
                key={input.name}
                className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"
              >
                <dt className="flex flex-wrap items-baseline gap-x-2">
                  <code className="font-mono text-sm font-semibold">{input.name}</code>
                  <span className="text-xs text-muted-foreground">
                    default: {input.def === "—" ? "empty" : input.def}
                  </span>
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {input.text}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Keeping MT5 running */}
      <section>
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
          <div className="flex items-center gap-3">
            <AlarmClock className="size-5 text-profit" aria-hidden="true" />
            <h2 className="text-2xl font-semibold tracking-tight">
              Keep the terminal running
            </h2>
          </div>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
            The EA journals events only while the terminal is open and connected. If it
            exits, queued events survive on disk (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              journal_queue.jsonl
            </code>
            ) and flush in order the next time the terminal comes back — but for true
            realtime journaling, run MT5 somewhere always-on:
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            <li className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold">MetaQuotes VPS</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Right-click the account in the Navigator → “Register a Virtual Server”.
                Migrates a running terminal with the EA included.
              </p>
            </li>
            <li className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold">Any Windows VPS</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                ~$5–10/month: install MT5 + the EA, sign in, leave it running. Works
                with any broker.
              </p>
            </li>
            <li className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold">Your own computer</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Fine for testing. On a Mac, MT5 desktop runs via
                PlayOnMac/Wine/CrossOver; compile with F7 exactly the same way.
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* Troubleshooting — native details/summary, zero JS */}
      <section id="troubleshooting" className="scroll-mt-14 border-y bg-muted/30">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Troubleshooting</h2>
          <div className="mt-8 divide-y rounded-xl border bg-card">
            {TROUBLESHOOTING.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="text-muted-foreground transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section>
        <div className="mx-auto w-full max-w-3xl px-4 py-14 text-center sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">
            Haven’t created your journal yet?
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-muted-foreground">
            Free account, your trades stay private to your login, and the checklist
            above walks you from key to first sync.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/register">
              Create your free account
              <ArrowRight className="ml-1 inline size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
