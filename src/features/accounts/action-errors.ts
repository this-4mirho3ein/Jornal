import { ZodError } from "zod";

/**
 * Error → toast-message mapping for account Server Actions.
 *
 * Pure (no db/auth imports) so it unit-tests without a runtime. The
 * cause-chain walk exists because drizzle-orm wraps driver errors in
 * `DrizzleQueryError` — the Postgres `code: "23505"` lives on `.cause`, not
 * on the top-level error, which is exactly why the first version of this
 * mapping kept showing the generic message for duplicate logins.
 */
const GENERIC = "Something went wrong. Please try again.";
const DUPLICATE =
  "An account with this broker login + server already exists (the EA bind or a previous entry created it). It's on your Accounts list — attach the EA to that row, or rotate its key if you want a fresh one.";

/** Walks `cause` links (drizzle wraps pg errors) looking for a 23505. */
function isUniqueViolation(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 4) return false;
  const record = error as {
    code?: unknown;
    constraint?: unknown;
    message?: unknown;
    cause?: unknown;
  };
  if (record.code === "23505") return true;
  if (
    typeof record.constraint === "string" &&
    record.constraint.includes("login_server")
  ) {
    return true;
  }
  if (typeof record.message === "string" && record.message.includes("duplicate key")) {
    return true;
  }
  return isUniqueViolation(record.cause, depth + 1);
}

export function mapAccountActionError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Invalid input.";
  }
  if (isUniqueViolation(error)) return DUPLICATE;
  return GENERIC;
}
