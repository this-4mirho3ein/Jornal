"use client";

import { Filter, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MultiSelect } from "@/components/shared/multi-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DEFAULT_SORT,
  SORTS,
  SORT_LABELS,
  STYLE_LABELS,
  tradesFiltersToQuery,
  type TradeSort,
  type TradeStyleFilter,
  type TradesFilters,
} from "@/features/trades/schemas";
import { cn } from "@/lib/utils";

/** Option lists the server precomputed from facets — the form never guesses. */
export interface FilterOptions {
  symbols: string[];
  strategies: Array<{ id: string; name: string; color: string | null }>;
  setups: Array<{ tag: string; count: number }>;
  mistakes: Array<{ tag: string; count: number }>;
}

export interface FiltersProps {
  initial: TradesFilters;
  options: FilterOptions;
}

type DirectionDraft = "" | "buy" | "sell";
type StatusDraft = "" | "open" | "closed";
type ResultDraft = "" | "win" | "loss" | "be";

interface FormState {
  symbols: string[];
  direction: DirectionDraft;
  status: StatusDraft;
  result: ResultDraft;
  styles: TradeStyleFilter[];
  strategies: string[];
  setups: string[];
  mistakes: string[];
  plMin: string;
  plMax: string;
  rMin: string;
  rMax: string;
  rating: number | null;
  preset: PresetKey;
  from: string;
  to: string;
  q: string;
  sort: TradeSort;
}

type PresetKey = "" | "today" | "7d" | "30d" | "month" | "last_month" | "ytd";

const PRESET_LABELS: Record<Exclude<PresetKey, "">, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  last_month: "Last month",
  ytd: "Year to date",
};

/** UTC-day presets; the server filters openedAt on UTC day boundaries. */
function presetRange(preset: Exclude<PresetKey, "">): {
  from: string;
  to: string;
} {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const day = now.getUTCDate();
  const iso = (d: Date) =>
    `${String(d.getUTCFullYear()).padStart(4, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  switch (preset) {
    case "today":
      return { from: iso(now), to: iso(now) };
    case "7d": {
      const from = new Date(now);
      from.setUTCDate(day - 6);
      return { from: iso(from), to: iso(now) };
    }
    case "30d": {
      const from = new Date(now);
      from.setUTCDate(day - 29);
      return { from: iso(from), to: iso(now) };
    }
    case "month":
      return {
        from: `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-01`,
        to: iso(now),
      };
    case "last_month": {
      const first = new Date(Date.UTC(y, m - 1, 1));
      const last = new Date(Date.UTC(y, m, 0));
      return { from: iso(first), to: iso(last) };
    }
    case "ytd":
      return { from: `${String(y).padStart(4, "0")}-01-01`, to: iso(now) };
  }
}

const decimalRe = /^-?\d{1,12}(\.\d{1,5})?$/;

function fromFilters(f: TradesFilters): FormState {
  return {
    symbols: f.symbols ?? [],
    direction: f.direction ?? "",
    status: f.status ?? "",
    result: f.result ?? "",
    styles: f.styles ?? [],
    strategies: f.strategies ?? [],
    setups: f.setups ?? [],
    mistakes: f.mistakes ?? [],
    plMin: f.plMin ?? "",
    plMax: f.plMax ?? "",
    rMin: f.rMin ?? "",
    rMax: f.rMax ?? "",
    rating: f.rating ?? null,
    preset: "",
    from: f.from ?? "",
    to: f.to ?? "",
    q: f.q ?? "",
    sort: f.sort ?? DEFAULT_SORT,
  };
}

function stateToFilters(s: FormState): TradesFilters {
  const filters: TradesFilters = { sort: s.sort, page: 1 };
  if (s.symbols.length) filters.symbols = s.symbols;
  if (s.direction) filters.direction = s.direction;
  if (s.status) filters.status = s.status;
  if (s.result) filters.result = s.result;
  if (s.styles.length) filters.styles = s.styles;
  if (s.strategies.length) filters.strategies = s.strategies;
  if (s.setups.length) filters.setups = s.setups;
  if (s.mistakes.length) filters.mistakes = s.mistakes;
  if (decimalRe.test(s.plMin)) filters.plMin = s.plMin;
  if (decimalRe.test(s.plMax)) filters.plMax = s.plMax;
  if (decimalRe.test(s.rMin)) filters.rMin = s.rMin;
  if (decimalRe.test(s.rMax)) filters.rMax = s.rMax;
  if (s.rating) filters.rating = s.rating;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.from)) filters.from = s.from;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.to)) filters.to = s.to;
  const q = s.q.trim().slice(0, 60);
  if (q) filters.q = q;
  return filters;
}

function pushUrl(router: ReturnType<typeof useRouter>, form: FormState) {
  const qs = tradesFiltersToQuery(stateToFilters(form));
  router.push(qs ? `/trades?${qs}` : "/trades", { scroll: false });
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-w-9 rounded-md px-2 py-1 text-xs transition-colors",
            value === option.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children, htmlFor }: { children: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
      {children}
    </label>
  );
}

function FiltersFields({
  form,
  set,
  options,
  idPrefix,
}: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  options: FilterOptions;
  idPrefix: string;
}) {
  const styleOptions = (Object.keys(STYLE_LABELS) as TradeStyleFilter[]).map(
    (value) => ({ value, label: STYLE_LABELS[value] }),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-search`}>Search</FieldLabel>
        <Input
          id={`${idPrefix}-search`}
          type="search"
          placeholder="Symbol, comment, notes…"
          value={form.q}
          onChange={(e) => set({ q: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<DirectionDraft>
          label="Direction"
          value={form.direction}
          onChange={(direction) => set({ direction })}
          options={[
            { value: "", label: "All" },
            { value: "buy", label: "Buy" },
            { value: "sell", label: "Sell" },
          ]}
        />
        <Segmented<StatusDraft>
          label="Status"
          value={form.status}
          onChange={(status) => set({ status })}
          options={[
            { value: "", label: "All" },
            { value: "open", label: "Open" },
            { value: "closed", label: "Closed" },
          ]}
        />
        <Segmented<ResultDraft>
          label="Result"
          value={form.result}
          onChange={(result) => set({ result })}
          options={[
            { value: "", label: "All" },
            { value: "win", label: "Win" },
            { value: "loss", label: "Loss" },
            { value: "be", label: "BE" },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <FieldLabel>Symbols</FieldLabel>
          <MultiSelect
            options={options.symbols.map((s) => ({ value: s, label: s }))}
            selected={form.symbols}
            onToggle={(symbol) =>
              set({
                symbols: form.symbols.includes(symbol)
                  ? form.symbols.filter((s) => s !== symbol)
                  : [...form.symbols, symbol],
              })
            }
            placeholder="Any symbol"
          />
        </div>
        <div className="grid gap-1.5">
          <FieldLabel>Strategies</FieldLabel>
          <MultiSelect
            options={options.strategies.map((s) => ({
              value: s.id,
              label: s.name,
            }))}
            selected={form.strategies}
            onToggle={(id) =>
              set({
                strategies: form.strategies.includes(id)
                  ? form.strategies.filter((s) => s !== id)
                  : [...form.strategies, id],
              })
            }
            placeholder="Any strategy"
          />
        </div>
        <div className="grid gap-1.5">
          <FieldLabel>Setup tags</FieldLabel>
          <MultiSelect
            options={options.setups.map((t) => ({
              value: t.tag,
              label: `${t.tag} (${t.count})`,
            }))}
            selected={form.setups}
            onToggle={(tag) =>
              set({
                setups: form.setups.includes(tag)
                  ? form.setups.filter((t) => t !== tag)
                  : [...form.setups, tag],
              })
            }
            placeholder="Any setup"
          />
        </div>
        <div className="grid gap-1.5">
          <FieldLabel>Mistake tags</FieldLabel>
          <MultiSelect
            options={options.mistakes.map((t) => ({
              value: t.tag,
              label: `${t.tag} (${t.count})`,
            }))}
            selected={form.mistakes}
            onToggle={(tag) =>
              set({
                mistakes: form.mistakes.includes(tag)
                  ? form.mistakes.filter((t) => t !== tag)
                  : [...form.mistakes, tag],
              })
            }
            placeholder="Any mistake"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <FieldLabel>Style</FieldLabel>
        <div role="group" aria-label="Trade styles" className="flex flex-wrap gap-1.5">
          {styleOptions.map((style) => {
            const active = form.styles.includes(style.value);
            return (
              <button
                key={style.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  set({
                    styles: active
                      ? form.styles.filter((s) => s !== style.value)
                      : [...form.styles, style.value],
                  })
                }
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {style.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="grid gap-1.5">
          <FieldLabel htmlFor={`${idPrefix}-plmin`}>P/L min</FieldLabel>
          <Input
            id={`${idPrefix}-plmin`}
            inputMode="decimal"
            placeholder="−100"
            value={form.plMin}
            onChange={(e) => set({ plMin: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <FieldLabel htmlFor={`${idPrefix}-plmax`}>P/L max</FieldLabel>
          <Input
            id={`${idPrefix}-plmax`}
            inputMode="decimal"
            placeholder="250"
            value={form.plMax}
            onChange={(e) => set({ plMax: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <FieldLabel htmlFor={`${idPrefix}-rmin`}>R min</FieldLabel>
          <Input
            id={`${idPrefix}-rmin`}
            inputMode="decimal"
            placeholder="−1"
            value={form.rMin}
            onChange={(e) => set({ rMin: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <FieldLabel htmlFor={`${idPrefix}-rmax`}>R max</FieldLabel>
          <Input
            id={`${idPrefix}-rmax`}
            inputMode="decimal"
            placeholder="3"
            value={form.rMax}
            onChange={(e) => set({ rMax: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="col-span-2 grid gap-1.5">
          <FieldLabel htmlFor={`${idPrefix}-preset`}>Date range (UTC)</FieldLabel>
          <Select
            value={form.preset}
            onValueChange={(preset) => {
              if (preset === "") {
                set({ preset: "" });
                return;
              }
              const key = preset as Exclude<PresetKey, "">;
              set({ preset: key, ...presetRange(key) });
            }}
          >
            <SelectTrigger id={`${idPrefix}-preset`} className="w-full">
              <SelectValue placeholder="Custom dates" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRESET_LABELS) as Exclude<PresetKey, "">[]).map(
                (preset) => (
                  <SelectItem key={preset} value={preset}>
                    {PRESET_LABELS[preset]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <FieldLabel htmlFor={`${idPrefix}-from`}>From</FieldLabel>
          <Input
            id={`${idPrefix}-from`}
            type="date"
            value={form.from}
            onChange={(e) => set({ from: e.target.value, preset: "" })}
          />
        </div>
        <div className="grid gap-1.5">
          <FieldLabel htmlFor={`${idPrefix}-to`}>To</FieldLabel>
          <Input
            id={`${idPrefix}-to`}
            type="date"
            value={form.to}
            onChange={(e) => set({ to: e.target.value, preset: "" })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <FieldLabel htmlFor={`${idPrefix}-rating`}>Min rating</FieldLabel>
          <Select
            value={form.rating ? String(form.rating) : ""}
            onValueChange={(v) => set({ rating: v ? Number(v) : null })}
          >
            <SelectTrigger id={`${idPrefix}-rating`} className="w-full">
              <SelectValue placeholder="Any rating" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {"★".repeat(n)} {n}+
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <FieldLabel htmlFor={`${idPrefix}-sort`}>Sort</FieldLabel>
          <Select
            value={form.sort}
            onValueChange={(sort) => set({ sort: sort as TradeSort })}
          >
            <SelectTrigger id={`${idPrefix}-sort`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((sort) => (
                <SelectItem key={sort} value={sort}>
                  {SORT_LABELS[sort]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

/**
 * Desktop filter bar (spec §11): every control applies immediately, search
 * is debounced 500 ms. The pushed URL keeps related rows/chips in sync via
 * the server re-render — no mirrored client list state.
 */
export function FiltersBar({ initial, options }: FiltersProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => fromFilters(initial));
  const appliedQRef = useRef(form.q);

  const push = (next: FormState) => pushUrl(router, next);

  // Search applies live after 500 ms without typing; the push happens inside
  // the timer callback, never during effect execution (react-hooks rules).
  useEffect(() => {
    if (form.q === appliedQRef.current) return;
    const timer = setTimeout(() => {
      appliedQRef.current = form.q;
      pushUrl(router, form);
    }, 500);
    return () => clearTimeout(timer);
  }, [form, router]);

  const empty = fromFilters({ sort: DEFAULT_SORT, page: 1 });

  return (
    <div className="rounded-xl border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
          Filters
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => {
            setForm(empty);
            router.push("/trades", { scroll: false });
          }}
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reset
        </Button>
      </div>
      <FiltersFields
        form={form}
        options={options}
        idPrefix="bar"
        set={(patch) => {
          const next = { ...form, ...patch };
          setForm(next);
          if (!("q" in patch)) push(next);
        }}
      />
    </div>
  );
}

/**
 * Desktop filters (spec §11): CLOSED until wanted (owner request, refined
 * 2026-11) — always, even when the URL already carries filters; the active
 * count badge and the chips row keep the applied filters discoverable while
 * the panel stays shut. Reopening rebuilds the fields from the latest
 * server `initial` (the URL remains the single source of truth).
 */
export function FiltersDisclosure({
  initial,
  options,
  activeCount,
}: FiltersProps & { activeCount: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Filter className="size-4" aria-hidden="true" />
        {open ? "Hide filters" : "Filters"}
        {activeCount > 0 ? (
          <Badge className="ml-1 h-5 px-1.5">{activeCount}</Badge>
        ) : null}
      </Button>
      {open ? <FiltersBar initial={initial} options={options} /> : null}
    </div>
  );
}

/**
 * Mobile filters (spec §11): a Filters button with an active-count badge
 * opens a bottom Sheet holding the same fields with an Apply/Reset footer —
 * nothing applies until Apply is pressed.
 */
export function FiltersSheet({
  initial,
  options,
  activeCount,
}: FiltersProps & { activeCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FormState>(() => fromFilters(initial));

  const empty = fromFilters({ sort: DEFAULT_SORT, page: 1 });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Open filters">
          <Filter className="size-4" aria-hidden="true" />
          Filters
          {activeCount > 0 ? (
            <Badge className="ml-1 h-5 px-1.5">{activeCount}</Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="flex max-h-[88dvh] flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Filters apply to the current account view. Dates are UTC days.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <FiltersFields
            form={draft}
            options={options}
            idPrefix="sheet"
            set={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          />
        </div>
        <SheetFooter className="flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setDraft(empty);
              setOpen(false);
              router.push("/trades", { scroll: false });
            }}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setOpen(false);
              pushUrl(router, draft);
            }}
          >
            Apply
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
