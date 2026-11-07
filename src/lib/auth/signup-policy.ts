/**
 * Registration policy (ADR 0009): sign-up is open by default so every trader
 * can create their own private journal. `SIGNUP_MODE=owner` restores the
 * original spec §15.2 single-owner allowlist — exactly OWNER_EMAIL, and only
 * while no credential account exists yet.
 *
 * Pure function — the Better Auth hook in lib/auth/server wires env + DB.
 */
export type SignUpMode = "owner" | "open";

export interface SignUpCheck {
  /** Registration mode resolved from SIGNUP_MODE (default: "open"). */
  mode: SignUpMode;
  /** Email from the sign-up request (any case — normalized here). */
  email: string;
  /** OWNER_EMAIL from the server env (any case/whitespace — normalized here). */
  ownerEmail: string | undefined;
  /** True when an `accounts_auth` row with provider_id = "credential" exists. */
  ownerAlreadyRegistered: boolean;
}

export function isSignUpAllowed({
  mode,
  email,
  ownerEmail,
  ownerAlreadyRegistered,
}: SignUpCheck): boolean {
  if (mode === "open") return true;
  if (!ownerEmail) return false;
  const requested = email.trim().toLowerCase();
  const allowed = ownerEmail.trim().toLowerCase();
  return allowed.length > 0 && requested === allowed && !ownerAlreadyRegistered;
}
