import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Camera,
  KeyRound,
  Layers,
  Smartphone,
  Wallet,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: { absolute: "Trading Journal — Realtime MetaTrader 5 Trade Journaling" },
  alternates: { canonical: "/" },
};

/** Landing copy lives here once so JSON-LD can mirror the visible text (§14). */
const FEATURES = [
  {
    icon: Zap,
    title: "Realtime MT5 sync",
    body: "An Expert Advisor inside MetaTrader 5 streams deal events to your journal over HTTPS. Positions, P/L and balance update in seconds — no manual export, no CSV imports.",
  },
  {
    icon: Layers,
    title: "Strategy tagging",
    body: "Trades are tagged automatically from the EA's magic number, the S:CODE marker in the order comment, or a per-account default strategy — and every stat can be filtered by strategy.",
  },
  {
    icon: BarChart3,
    title: "R-multiple analytics",
    body: "Every trade is scored in R, so you can compare setups across symbols, sessions and account sizes. Win rate, expectancy and profit factor update as trades close.",
  },
  {
    icon: Camera,
    title: "Trade screenshots",
    body: "Attach charts from your phone right after the close. They're compressed client-side, stored in blob storage, and shown in a fast gallery with lazy lightbox.",
  },
  {
    icon: Wallet,
    title: "Balance & cash operations",
    body: "Deposits and withdrawals are tracked separately from trading P/L, so performance math never lies when you top up or take money out of an account.",
  },
  {
    icon: Smartphone,
    title: "Mobile-first PWA",
    body: "Add the journal to your home screen and review trades anywhere — bottom tab bar, large touch targets, dark mode, and updates that arrive even while the tab is in the background.",
  },
] as const;

/** How-it-works steps (§14 demo/FAQ narrative). */
const STEPS = [
  {
    icon: KeyRound,
    title: "Install the EA",
    body: "Drop the bundled Expert Advisor into your MT5 terminal, paste your personal ingest key, and allow WebRequest for your journal URL. Two minutes, zero code.",
  },
  {
    icon: Zap,
    title: "Trade normally",
    body: "Every open, close and partial fill is pushed to the journal's ingest endpoint and reduced into trades — net P/L, R-multiple, duration, MAE/MFE — in realtime.",
  },
  {
    icon: BarChart3,
    title: "Review your edge",
    body: "Dashboard KPIs, equity curve, R distribution and strategy breakdowns. Add notes, emotions, ratings and setup tags; override anything manually after the fact.",
  },
] as const;

const FAQ = [
  {
    q: "Does my broker need to support anything special?",
    a: "No. The Expert Advisor talks to your journal over plain HTTPS WebRequest from any MetaTrader 5 terminal — demo or live, raw or standard account, any broker that lets you run EAs.",
  },
  {
    q: "Is my trading data private?",
    a: "Yes. The journal is a single-owner installation behind login: only one email address is allowed to register, all app pages are marked noindex, the ingest endpoint is rate-limited and requires a per-account key, and screenshots live in private blob storage.",
  },
  {
    q: "Do I have to import trades manually?",
    a: "No. The EA streams deal events in realtime and the journal reconstructs full trades, including partial closes. Manual editing is only for journaling — notes, emotions, ratings and setup tags.",
  },
  {
    q: "How are trades assigned to strategies automatically?",
    a: "In order: first the EA's magic-number mapping, then the S:CODE marker in the MT5 order comment, then the account's default strategy. You can always change a trade's style or tags by hand later.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes — the journal is mobile-first. It installs as a PWA (add to home screen), all touch targets are sized for thumbs, and realtime updates arrive while the app is in the background.",
  },
  {
    q: "Can I track prop firm challenges?",
    a: "Yes. Connect each account separately — live, demo or prop — and the journal keeps balances, P/L and rules metrics per account. Cash operations are excluded from trading performance, so payouts and top-ups never skew your stats.",
  },
] as const;

function JsonLd() {
  const softwareApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Trading Journal",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    description:
      "Realtime trading journal for MetaTrader 5: automatic trade sync, strategy tagging, R-multiple analytics and trade screenshots — private, mobile-first, PWA installable.",
  };
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  // JSON.stringify does not escape "<" — scrub it (installed Next.js JSON-LD guide).
  const scrub = (json: object) =>
    JSON.stringify(json).replace(/</g, "\\u003c");
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: scrub(softwareApp) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: scrub(faqPage) }}
      />
    </>
  );
}

/** Decorative dashboard mock — pure CSS/SVG, zero JS, hidden from a11y tree. */
function DashboardMock() {
  return (
    <div
      aria-hidden="true"
      className="relative rounded-2xl border bg-card shadow-2xl"
    >
      <div className="flex items-center gap-1.5 border-b px-4 py-3">
        <span className="size-2.5 rounded-full bg-red-400/70" />
        <span className="size-2.5 rounded-full bg-amber-400/70" />
        <span className="size-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-3 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          Dashboard
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4">
        <div className="rounded-lg border bg-background p-2.5 sm:p-3">
          <p className="text-[10px] text-muted-foreground sm:text-xs">Net P/L</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-profit sm:text-lg">
            +$1,109.21
          </p>
        </div>
        <div className="rounded-lg border bg-background p-2.5 sm:p-3">
          <p className="text-[10px] text-muted-foreground sm:text-xs">Win rate</p>
          <p className="mt-1 text-sm font-semibold tabular-nums sm:text-lg">
            58.6%
          </p>
        </div>
        <div className="rounded-lg border bg-background p-2.5 sm:p-3">
          <p className="text-[10px] text-muted-foreground sm:text-xs">Avg R</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-profit sm:text-lg">
            +0.42R
          </p>
        </div>
        <div className="col-span-3 rounded-lg border bg-background p-3">
          <p className="text-[10px] text-muted-foreground sm:text-xs">
            Equity curve
          </p>
          <svg
            viewBox="0 0 560 120"
            className="mt-2 h-20 w-full sm:h-24"
            preserveAspectRatio="none"
          >
            <path
              d="M0,100 L40,92 L80,96 L120,78 L160,84 L200,64 L240,72 L280,50 L320,58 L360,40 L400,46 L440,26 L480,34 L520,16 L560,20 L560,120 L0,120 Z"
              fill="url(#eq-fill)"
            />
            <path
              d="M0,100 L40,92 L80,96 L120,78 L160,84 L200,64 L240,72 L280,50 L320,58 L360,40 L400,46 L440,26 L480,34 L520,16 L560,20"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
            />
            <defs>
              <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <span className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-emerald-500/10 via-transparent to-amber-500/10 blur-2xl" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <JsonLd />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
              <Zap className="size-3.5 text-profit" aria-hidden="true" />
              Built for MetaTrader 5
            </p>
            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Your MT5 trades, journaled automatically
            </h1>
            <p className="mt-4 max-w-prose text-pretty text-base text-muted-foreground sm:text-lg">
              Trading Journal syncs every deal from your MetaTrader 5 terminal
              in realtime — then turns them into strategy-tagged, R-scored
              analytics you can actually learn from. Private by design,
              installable on your phone.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/login">Open your journal</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#how">See how it works</a>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Single-owner install — your data never leaves your own database.
            </p>
          </div>
          <DashboardMock />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-muted/30 scroll-mt-14">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything a serious trading journal needs
          </h2>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Built around one loop: trade, sync automatically, review honestly.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="rounded-xl border bg-card p-5 shadow-sm"
              >
                <Icon
                  className="size-5 text-profit"
                  aria-hidden="true"
                />
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-14">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Up and running in minutes
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, index) => (
              <li
                key={title}
                className="relative rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-profit/10 text-sm font-semibold text-profit tabular-nums">
                    {index + 1}
                  </span>
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ — native details/summary keeps this zero-JS and accessible */}
      <section id="faq" className="border-t bg-muted/30 scroll-mt-14">
        <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Frequently asked questions
          </h2>
          <div className="mt-8 divide-y rounded-xl border bg-card">
            {FAQ.map((item) => (
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
        <div className="mx-auto w-full max-w-6xl px-4 py-14 text-center sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Start journaling in minutes
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-muted-foreground">
            Connect your MT5 terminal once — every trade after that journals
            itself.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/login">Open your journal</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
