/**
 * Connection level from the EA heartbeat (spec §8.1):
 * green < 3 min, amber < 15 min, red otherwise; never-seen = offline.
 */
export type ConnectionLevel = "live" | "delayed" | "offline";

export const LIVE_THRESHOLD_MS = 3 * 60 * 1000;
export const DELAYED_THRESHOLD_MS = 15 * 60 * 1000;

export function connectionLevel(
  lastSeen: Date | string | null,
  now: Date,
): ConnectionLevel {
  if (!lastSeen) return "offline";
  const seen = typeof lastSeen === "string" ? new Date(lastSeen) : lastSeen;
  const age = now.getTime() - seen.getTime();
  if (age < LIVE_THRESHOLD_MS) return "live";
  if (age < DELAYED_THRESHOLD_MS) return "delayed";
  return "offline";
}
