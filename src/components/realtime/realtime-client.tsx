"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  TRADE_UPDATED_EVENT,
  TRADE_UPDATED_UI_EVENT,
  type TradeUpdatePayload,
} from "@/lib/realtime/payload";

const FALLBACK_POLL_MS = 5000; // §6.5.3

/** Structural slice of pusher-js — keeps the SDK type-free for SSR bundles. */
interface PusherChannelLike {
  bind(event: string, callback: (data: unknown) => void): unknown;
}
interface PusherClientLike {
  subscribe(channel: string): PusherChannelLike;
  unsubscribe(channel: string): void;
  disconnect(): void;
}
type PusherCtorLike = new (
  key: string,
  options: { cluster: string; authEndpoint: string },
) => PusherClientLike;

interface RealtimeClientProps {
  enabled: boolean;
  userId: string;
  pusherKey: string | null;
  pusherCluster: string | null;
}

/** Defensive parse — channel JSON is external data (§0) and may be anything. */
function normalizePayload(raw: unknown): TradeUpdatePayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.type !== "string") return null;
  let trade: TradeUpdatePayload["trade"] = null;
  if (typeof record.trade === "object" && record.trade !== null) {
    const summary = record.trade as Record<string, unknown>;
    trade = {
      symbol: typeof summary.symbol === "string" ? summary.symbol : "",
      direction: summary.direction === "sell" ? "sell" : "buy",
      price: typeof summary.price === "number" ? summary.price : null,
      profit: typeof summary.profit === "number" ? summary.profit : null,
    };
  }
  return {
    accountId: typeof record.accountId === "string" ? record.accountId : "",
    tradeId: typeof record.tradeId === "string" ? record.tradeId : null,
    type: record.type,
    trade,
  };
}

/** §6.5.4 toasts — deals only; heartbeats/snapshots refresh silently. */
function toastFor(payload: TradeUpdatePayload): string | null {
  const trade = payload.trade;
  if (!trade || !trade.symbol) return null;
  if (payload.type === "deal_open") {
    const side = trade.direction === "buy" ? "Buy" : "Sell";
    const price = trade.price !== null ? ` @ ${trade.price.toFixed(2)}` : "";
    return `New trade: ${trade.symbol} ${side}${price}`;
  }
  if (payload.type === "deal_close") {
    const profit = trade.profit ?? 0;
    return `Trade closed: ${trade.symbol} ${profit >= 0 ? "+" : ""}${profit.toFixed(2)}`;
  }
  return null;
}

/**
 * §6.5.2–3 — Pusher subscription when the feature flag is on, a 5 s
 * visible-tab polling fallback when not. Either way a trade event triggers
 * `router.refresh()` (Server Components hold the data), a toast for deals
 * and a DOM event that lets visible rows flash. Renders nothing.
 */
export function RealtimeClient({
  enabled,
  userId,
  pusherKey,
  pusherCluster,
}: RealtimeClientProps) {
  const router = useRouter();
  const refreshingRef = useRef(false);
  const pusherRef = useRef<PusherClientLike | null>(null);

  const refreshNow = useCallback(() => {
    // Background tabs must not burn refreshes against either path.
    if (document.visibilityState !== "visible" || refreshingRef.current) return;
    refreshingRef.current = true;
    router.refresh();
    // Collapse event bursts (e.g. the EA draining its offline queue).
    window.setTimeout(() => {
      refreshingRef.current = false;
    }, 1000);
  }, [router]);

  useEffect(() => {
    if (!enabled) {
      const interval = window.setInterval(refreshNow, FALLBACK_POLL_MS);
      return () => window.clearInterval(interval);
    }
    if (!pusherKey || !pusherCluster) return;

    let disposed = false;
    const channelName = `private-user-${userId}`;

    void (async () => {
      try {
        const mod = await import("pusher-js");
        if (disposed) return;
        const ctor = ((mod as { default?: PusherCtorLike }).default ??
          mod) as unknown as PusherCtorLike;
        const client = new ctor(pusherKey, {
          cluster: pusherCluster,
          authEndpoint: "/api/realtime/auth",
        });
        pusherRef.current = client;
        client.subscribe(channelName).bind(TRADE_UPDATED_EVENT, (data) => {
          const payload = normalizePayload(data);
          refreshNow();
          if (payload?.tradeId) {
            window.dispatchEvent(
              new CustomEvent(TRADE_UPDATED_UI_EVENT, {
                detail: { tradeId: payload.tradeId },
              }),
            );
          }
          const tradeId = payload?.tradeId ?? null;
          const message = payload ? toastFor(payload) : null;
          if (message && tradeId) {
            const href = `/trades/${tradeId}`;
            toast(message, {
              action: { label: "View", onClick: () => router.push(href) },
            });
          } else if (message) {
            toast(message);
          }
        });
      } catch (err) {
        // Subscription failure degrades to silence, never a page crash.
        console.error("[realtime] subscription failed:", err);
      }
    })();

    return () => {
      disposed = true;
      const client = pusherRef.current;
      if (client) {
        client.unsubscribe(channelName);
        client.disconnect();
        pusherRef.current = null;
      }
    };
  }, [enabled, pusherKey, pusherCluster, userId, refreshNow, router]);

  return null;
}
