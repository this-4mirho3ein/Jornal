"use client";

import { useEffect, useState } from "react";

import { TRADE_UPDATED_UI_EVENT } from "@/lib/realtime/payload";

/**
 * §6.5.4 — subtle row/card highlight: true for ~1.5 s after a realtime
 * event names this trade. The CSS animation (globals.css `tj-row-flash`)
 * fades out; the reduced-motion media query flattens it to an instant
 * background blip. Restarts cleanly if the row is already flashing.
 */
export function useTradeFlash(tradeId: string): boolean {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    function onTradeUpdated(event: Event) {
      const detail = (event as CustomEvent<{ tradeId?: string | null }>).detail;
      if (detail?.tradeId !== tradeId) return;
      // Re-flow via rAF so a second event restarts the animation instead of
      // the class no-op-ing (React keeps the same class name).
      setFlash(false);
      requestAnimationFrame(() => setFlash(true));
      window.setTimeout(() => setFlash(false), 1600);
    }
    window.addEventListener(TRADE_UPDATED_UI_EVENT, onTradeUpdated);
    return () => window.removeEventListener(TRADE_UPDATED_UI_EVENT, onTradeUpdated);
  }, [tradeId]);

  return flash;
}
