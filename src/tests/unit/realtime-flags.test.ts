import { afterEach, describe, expect, it, vi } from "vitest";

import { isRealtimeEnabled } from "@/lib/realtime/flags";

const ALL_VARS: Record<string, string> = {
  PUSHER_APP_ID: "app-1",
  PUSHER_KEY: "key-1",
  PUSHER_SECRET: "secret-1",
  PUSHER_CLUSTER: "eu",
  NEXT_PUBLIC_PUSHER_KEY: "key-1",
  NEXT_PUBLIC_PUSHER_CLUSTER: "eu",
};

function stubAll() {
  for (const [key, value] of Object.entries(ALL_VARS)) {
    vi.stubEnv(key, value);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("realtime feature flag (§19)", () => {
  it("is on only when both server and browser halves are configured", () => {
    stubAll();
    expect(isRealtimeEnabled()).toBe(true);
  });

  it("requires every one of the six vars", () => {
    for (const missing of Object.keys(ALL_VARS)) {
      stubAll();
      // Delete the var under test so host env remnants can't leak in.
      vi.stubEnv(missing, undefined);
      expect(isRealtimeEnabled()).toBe(false);
      vi.unstubAllEnvs();
    }
  });
});
