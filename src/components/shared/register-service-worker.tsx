"use client";

import { useEffect } from "react";

/**
 * Registers the offline-fallback service worker (public/sw.js) in production
 * only — dev runs must never see a SW between the browser and HMR. The SW
 * itself caches only immutable build assets plus /offline; nothing dynamic.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration must never break the app — offline support
        // is progressive enhancement.
      });
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
