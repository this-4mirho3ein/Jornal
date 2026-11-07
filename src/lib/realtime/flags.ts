/**
 * Realtime feature flag (spec §19): Pusher is wired only when BOTH halves
 * are configured — the server trigger credentials and the public browser
 * key/cluster (public by design; no secrets are exposed to the client).
 * Absent ⇒ clients fall back to the 5 s polling path (§6.5.3).
 */
export function isRealtimeEnabled(): boolean {
  return Boolean(
    process.env.PUSHER_APP_ID &&
      process.env.PUSHER_KEY &&
      process.env.PUSHER_SECRET &&
      process.env.PUSHER_CLUSTER &&
      process.env.NEXT_PUBLIC_PUSHER_KEY &&
      process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  );
}
