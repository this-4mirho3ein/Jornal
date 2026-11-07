"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney } from "@/lib/format";

const POSITIVE = "#10b981";
const NEGATIVE = "#ef4444";

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
          formatter={(value) => [
            formatMoney(String(value), { currency }),
            "Equity",
          ]}
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
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
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
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
          formatter={(value) => [
            formatMoney(String(value), { currency }),
            "Net P/L",
          ]}
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
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
export function RDistributionChart({ data }: { data: Array<{ label: string; n: number }> }) {
  const LOSS_BUCKETS = 3; // labels 0..2 are losses
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} width={32} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(value) => [String(value), "Trades"]}
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
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
