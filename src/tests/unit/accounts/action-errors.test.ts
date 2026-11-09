import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";

import { mapAccountActionError } from "@/features/accounts/action-errors";

const GENERIC = "Something went wrong. Please try again.";
const DUPLICATE = "An account with this broker login + server already exists";

/** drizzle-orm's real wrapper: the pg error hides on `.cause`. */
class FakeDrizzleQueryError extends Error {
  cause: unknown;
  constructor(cause: unknown) {
    super("Failed query: INSERT INTO trading_accounts …");
    this.cause = cause;
  }
}

function pgUniqueError(constraint?: string) {
  const err = new Error(
    'duplicate key value violates unique constraint "trading_accounts_user_login_server_uq"',
  ) as Error & { code?: string; constraint?: string; detail?: string };
  err.code = "23505";
  if (constraint) err.constraint = constraint;
  return err;
}

function zodIssue(message: string) {
  const result = z
    .object({ login: z.string().max(1) })
    .safeParse({ login: "_toolong" });
  if (result.success) throw new Error("expected parse failure");
  // Rebuild a ZodError carrying the wanted message verbatim.
  return new ZodError(result.error.issues.map((i) => ({ ...i, message })));
}

describe("mapAccountActionError", () => {
  it("surfaces the first Zod issue message", () => {
    expect(mapAccountActionError(zodIssue("Login must be digits only"))).toBe(
      "Login must be digits only",
    );
  });

  it("maps a bare pg 23505 to the duplicate hint", () => {
    expect(mapAccountActionError(pgUniqueError())).toContain(DUPLICATE);
  });

  it("unwraps drizzle's DrizzleQueryError.cause to find 23505", () => {
    expect(mapAccountActionError(new FakeDrizzleQueryError(pgUniqueError()))).toContain(
      DUPLICATE,
    );
  });

  it("unwraps nested causes a few levels deep", () => {
    const deep = new Error("level 2", { cause: pgUniqueError() });
    const shallower = new Error("level 1", { cause: deep });
    expect(mapAccountActionError(shallower)).toContain(DUPLICATE);
  });

  it("matches the constraint name even without a code", () => {
    const err = new Error("oops") as Error & { constraint?: string };
    err.constraint = "trading_accounts_user_login_server_uq";
    expect(mapAccountActionError(new FakeDrizzleQueryError(err))).toContain(DUPLICATE);
  });

  it("falls back to the generic message for unrelated errors", () => {
    expect(mapAccountActionError(new Error("connection refused"))).toBe(GENERIC);
    expect(mapAccountActionError(undefined)).toBe(GENERIC);
    expect(mapAccountActionError(new FakeDrizzleQueryError(new Error("timeout")))).toBe(
      GENERIC,
    );
  });
});
