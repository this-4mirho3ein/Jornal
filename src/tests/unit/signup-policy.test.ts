import { describe, expect, it } from "vitest";

import { isSignUpAllowed } from "@/lib/auth/signup-policy";

const ownerEmail = "owner@example.com";

describe("isSignUpAllowed — open mode (ADR 0009 default)", () => {
  it("allows any email without consulting the owner allowlist", () => {
    expect(
      isSignUpAllowed({
        mode: "open",
        email: "anyone@example.com",
        ownerEmail: undefined,
        ownerAlreadyRegistered: true,
      }),
    ).toBe(true);
  });

  it("allows even the owner email while other accounts exist", () => {
    expect(
      isSignUpAllowed({
        mode: "open",
        email: ownerEmail,
        ownerEmail,
        ownerAlreadyRegistered: true,
      }),
    ).toBe(true);
  });
});

describe("isSignUpAllowed — owner mode (SIGNUP_MODE=owner, spec §15.2)", () => {
  it("allows the owner email when no credential exists", () => {
    expect(
      isSignUpAllowed({
        mode: "owner",
        email: ownerEmail,
        ownerEmail,
        ownerAlreadyRegistered: false,
      }),
    ).toBe(true);
  });

  it("is case-insensitive and trims the owner env value", () => {
    expect(
      isSignUpAllowed({
        mode: "owner",
        email: "OWNER@EXAMPLE.COM",
        ownerEmail: "  owner@example.com ",
        ownerAlreadyRegistered: false,
      }),
    ).toBe(true);
  });

  it("rejects any non-owner email (fail closed)", () => {
    expect(
      isSignUpAllowed({
        mode: "owner",
        email: "attacker@example.com",
        ownerEmail,
        ownerAlreadyRegistered: false,
      }),
    ).toBe(false);
  });

  it("rejects the owner email once a credential account exists", () => {
    expect(
      isSignUpAllowed({
        mode: "owner",
        email: ownerEmail,
        ownerEmail,
        ownerAlreadyRegistered: true,
      }),
    ).toBe(false);
  });

  it("rejects everything when OWNER_EMAIL is not configured", () => {
    expect(
      isSignUpAllowed({
        mode: "owner",
        email: ownerEmail,
        ownerEmail: undefined,
        ownerAlreadyRegistered: false,
      }),
    ).toBe(false);
  });

  it("rejects empty emails", () => {
    expect(
      isSignUpAllowed({
        mode: "owner",
        email: "",
        ownerEmail,
        ownerAlreadyRegistered: false,
      }),
    ).toBe(false);
  });
});
