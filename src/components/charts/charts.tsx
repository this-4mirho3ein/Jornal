"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney } from "@/lib/format";

const POSITIVE = "#10b981";
const NEGATIVE = "#ef4444";
const BREAKEVEN = "#94a3b8";

/** Compact tick numbers for column axes (full money lives in the tooltip). */
function compactTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(value * 10) / 10);
}

/** §10 equity curve (account-timezone timestamps as short labels). */
export function EquityCurveChart({
  points,
  currency,
}: {
  points: Array<{ t: string; value: string }>;
  currency: string;
}) {
  const data = points.map((point) => ({
    t: new Date(point.t).toISOString().slice(5, 16).replace("T", " "),
    value: Number(point.value),
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={POSITIVE} stopOpacity={0.35} />
            <stop offset="100%" stopColor={POSITIVE} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
        <XAxis
          dataKey="t"
          tick={{ fontSize: 10 }}
          minTickGap={48}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          width={72}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          domain={["auto", "auto"]}
        />
        <Tooltip
          formatter={(value) => [formatMoney(String(value), { currency }), "Equity"]}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={POSITIVE}
          strokeWidth={2}
          fill="url(#equity-fill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Horizontal net-P/L bars for a breakdown (§10); sign-colored. */
export function BreakdownBars({
  data,
  currency,
}: {
  data: Array<{ label: string; net: string }>;
  currency: string;
}) {
  const rows = data.map((row) => ({ ...row, value: Number(row.net) }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, rows.length * 34)}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={96}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value) => [formatMoney(String(value), { currency }), "Net P/L"]}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {rows.map((row, index) => (
            <Cell key={index} fill={row.value >= 0 ? POSITIVE : NEGATIVE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** R-multiple histogram (left red, right green of zero). */
export function RDistributionChart({
  data,
}: {
  data: Array<{ label: string; n: number }>;
}) {
  const LOSS_BUCKETS = 3; // labels 0..2 are losses
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          width={32}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value) => [String(value), "Trades"]}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="n" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((row, index) => (
            <Cell key={row.label} fill={index < LOSS_BUCKETS ? NEGATIVE : POSITIVE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Win rate center label: decided-only (breakeven trades excluded), safe division. */
export function WinLossDonut({
  wins,
  losses,
  breakeven,
  net,
  currency,
}: {
  wins: number;
  losses: number;
  breakeven: number;
  net: string;
  currency: string;
}) {
  const data = [
    { name: "Wins", value: wins, fill: POSITIVE },
    { name: "Losses", value: losses, fill: NEGATIVE },
    { name: "Breakeven", value: breakeven, fill: BREAKEVEN },
  ].filter((slice) => slice.value > 0);
  const decided = wins + losses;
  const winRate = decided > 0 ? Math.round((wins / decided) * 1000) / 10 : null;

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={210}>
          <PieChart>
            <Tooltip
              formatter={(value, name) => [
                `${value} trade${value === 1 ? "" : "s"}`,
                name,
              ]}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={88}
              paddingAngle={3}
              cornerRadius={4}
              startAngle={90}
              endAngle={-270}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums">
            {winRate === null ? "—" : `${winRate}%`}
          </span>
          <span className="text-xs text-muted-foreground">win rate</span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        {data.map((slice) => (
          <span key={slice.name} className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ background: slice.fill }}
              aria-hidden="true"
            />
            {slice.name} · {slice.value}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-center text-xs text-muted-foreground">
        Net{" "}
        <span className="font-mono tabular-nums">
          {formatMoney(net, { currency, signed: true })}
        </span>
      </p>
    </div>
  );
}

/** Vertical net-P/L columns for time-like axes (weekday, hour) — sign-colored. */
export function BreakdownColumns({
  data,
  currency,
}: {
  data: Array<{ label: string; net: string }>;
  currency: string;
}) {
  const rows = data.map((row) => ({ ...row, value: Number(row.net) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="currentColor"
          opacity={0.12}
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <YAxis
          width={52}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={compactTick}
        />
        <Tooltip
          cursor={{ fill: "currentColor", opacity: 0.06 }}
          formatter={(value) => [formatMoney(String(value), { currency }), "Net P/L"]}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {rows.map((row, index) => (
            <Cell key={index} fill={row.value >= 0 ? POSITIVE : NEGATIVE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
