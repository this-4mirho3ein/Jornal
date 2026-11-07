/**
 * Pusher channel naming + ownership validation (spec §6.5.2).
 *
 * The auth endpoint must refuse any channel that does not name exactly the
 * authenticated user — subscribing to someone else's `private-user-<id>`
 * would leak their trade events. Kept framework-free so it unit-tests
 * without Next.js environment setup.
 */
const CHANNEL_PREFIX = "private-user-";

/**
 * Better Auth ids are opaque tokens ([A-Za-z0-9_-]); the length cap stops
 * pathological channel strings from reaching the signing step.
 */
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;

/** Canonical channel carrying this user's trade events. */
export function userChannelName(userId: string): string {
  return `${CHANNEL_PREFIX}${userId}`;
}

/** The user id embedded in a channel name, or null for anything malformed. */
export function channelUserId(channel: string): string | null {
  if (!channel.startsWith(CHANNEL_PREFIX)) return null;
  const id = channel.slice(CHANNEL_PREFIX.length);
  return USER_ID_PATTERN.test(id) ? id : null;
}

/** Auth-endpoint gate: the session user may only subscribe to their own channel. */
export function canSubscribe(channel: string, userId: string): boolean {
  return channelUserId(channel) === userId;
}
