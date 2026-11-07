import { describe, expect, it } from "vitest";

import { canSubscribe, channelUserId, userChannelName } from "@/lib/realtime/channel";

describe("realtime channel validator (§6.5.2)", () => {
  it("round-trips a user id through the channel name", () => {
    const id = "bjjfka4rgyngepyuxwu3pkge";
    expect(userChannelName(id)).toBe(`private-user-${id}`);
    expect(channelUserId(userChannelName(id))).toBe(id);
    expect(canSubscribe(userChannelName(id), id)).toBe(true);
  });

  it("accepts uuid-style better-auth ids", () => {
    const uuid = "00000000-0000-4000-8000-000000000002";
    expect(channelUserId(`private-user-${uuid}`)).toBe(uuid);
  });

  it("refuses another user's channel (ownership gate)", () => {
    expect(canSubscribe("private-user-victim-user-id", "me-the-attacker")).toBe(false);
  });

  it("refuses non-private or malformed channels", () => {
    for (const channel of [
      "",
      "public-user-x",
      "private-channel-x",
      "private-user-",
      "private-user- ",
      "private-user-<script>",
      "private-user-../../admin",
    ]) {
      expect(channelUserId(channel)).toBeNull();
    }
  });

  it("enforces a sane id length cap", () => {
    expect(channelUserId(`private-user-${"a".repeat(5)}`)).toBeNull();
    expect(channelUserId(`private-user-${"a".repeat(129)}`)).toBeNull();
    expect(channelUserId(`private-user-${"a".repeat(128)}`)).toBe("a".repeat(128));
  });
});
