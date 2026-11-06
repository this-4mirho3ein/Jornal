import { describe, expect, it } from "vitest";

import { isOwnerAllowedToSignUp } from "@/lib/auth/owner-policy";

describe("isOwnerAllowedToSignUp (spec §15.2)", () => {
  const ownerEmail = "owner@example.com";

  it("allows the owner email when no credential exists", () => {
    expect(
      isOwnerAllowedToSignUp({
        email: ownerEmail,
        ownerEmail,
        ownerAlreadyRegistered: false,
      }),
    ).toBe(true);
  });

  it("is case-insensitive and trims the owner env value", () => {
    expect(
      isOwnerAllowedToSignUp({
        email: "OWNER@EXAMPLE.COM",
        ownerEmail: "  owner@example.com ",
        ownerAlreadyRegistered: false,
      }),
    ).toBe(true);
  });

  it("rejects any non-owner email (fail closed)", () => {
    expect(
      isOwnerAllowedToSignUp({
        email: "attacker@example.com",
        ownerEmail,
        ownerAlreadyRegistered: false,
      }),
    ).toBe(false);
  });

  it("rejects the owner email once a credential account exists", () => {
    expect(
      isOwnerAllowedToSignUp({
        email: ownerEmail,
        ownerEmail,
        ownerAlreadyRegistered: true,
      }),
    ).toBe(false);
  });

  it("rejects everything when OWNER_EMAIL is not configured", () => {
    expect(
      isOwnerAllowedToSignUp({
        email: ownerEmail,
        ownerEmail: undefined,
        ownerAlreadyRegistered: false,
      }),
    ).toBe(false);
  });

  it("rejects empty emails", () => {
    expect(
      isOwnerAllowedToSignUp({
        email: "",
        ownerEmail,
        ownerAlreadyRegistered: false,
      }),
    ).toBe(false);
  });
});
