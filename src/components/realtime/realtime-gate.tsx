import { connection } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import { isRealtimeEnabled } from "@/lib/realtime/flags";
import { RealtimeClient } from "@/components/realtime/realtime-client";

/**
 * Server-side mount point for the realtime client (§6.5): resolves the
 * session and the feature flag at request time, then hands the browser its
 * own user id for the private channel — the client never chooses the channel
 * name, the auth endpoint re-verifies ownership anyway.
 */
export async function RealtimeGate() {
  await connection();
  const user = await getCurrentUser();
  return (
    <RealtimeClient
      enabled={isRealtimeEnabled()}
      userId={user.id}
      pusherKey={process.env.NEXT_PUBLIC_PUSHER_KEY ?? null}
      pusherCluster={process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? null}
    />
  );
}
