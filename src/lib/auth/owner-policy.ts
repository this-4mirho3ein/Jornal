/**
 * Owner-allowlist predicate (spec §15.2): exactly one user (OWNER_EMAIL) may
 * ever register, and only while no credential account exists yet.
 * Pure function — the Better Auth hook in lib/auth/server wires env + DB.
 */
export interface OwnerSignUpCheck {
  /** Email from the sign-up request (any case — normalized here). */
  email: string;
  /** OWNER_EMAIL from the server env (any case/whitespace — normalized here). */
  ownerEmail: string | undefined;
  /** True when an `accounts_auth` row with provider_id = "credential" exists. */
  ownerAlreadyRegistered: boolean;
}

export function isOwnerAllowedToSignUp({
  email,
  ownerEmail,
  ownerAlreadyRegistered,
}: OwnerSignUpCheck): boolean {
  if (!ownerEmail) return false;
  const requested = email.trim().toLowerCase();
  const allowed = ownerEmail.trim().toLowerCase();
  return allowed.length > 0 && requested === allowed && !ownerAlreadyRegistered;
}
