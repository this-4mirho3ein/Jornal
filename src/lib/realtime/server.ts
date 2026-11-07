/**
 * Lazy Pusher REST client (server-side only). Constructed on first use and
 * cached for the process; returns null while the feature flag is off so
 * callers degrade to the polling fallback instead of crashing (§19).
 */
import Pusher from "pusher";

import { isRealtimeEnabled } from "@/lib/realtime/flags";

let client: Pusher | null = null;

export function getPusherServer(): Pusher | null {
  if (!isRealtimeEnabled()) return null;
  if (!client) {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.PUSHER_CLUSTER;
    if (!appId || !key || !secret || !cluster) return null; // narrowed by the flag; keeps types honest
    client = new Pusher({ appId, key, secret, cluster });
  }
  return client;
}
