import { cookies } from "next/headers";

import type { TradingAccount } from "@/db/schema";
import {
  ACTIVE_ACCOUNT_ALL,
  ACTIVE_ACCOUNT_COOKIE,
} from "@/features/accounts/constants";
import { getAccountById, getUserAccounts } from "@/features/accounts/queries";

/** Page props' `searchParams` promise shape (Next.js: always a Promise). */
export type AccountSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export interface ActiveAccountResolution {
  /** null = aggregate "All accounts" view. */
  account: TradingAccount | null;
  /** All non-archived accounts — for aggregate views on data pages. */
  accounts: TradingAccount[];
}

function requestedAccountId(
  params: Record<string, string | string[] | undefined>,
): string | null {
  const raw = params.account;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ?? null;
}

/**
 * Active-account resolution for pages (spec §8.1): URL `?account=<id>` wins,
 * then the `tj_account` cookie, else the first (creation-order) account in
 * aggregate mode when the cookie holds the "all" sentinel. Every candidate is
 * ownership-validated — an invalid/foreign/unavailable id silently falls back,
 * so pages never render another user's data. Reads cookies() → render the
 * caller inside `<Suspense>` under cacheComponents.
 */
export async function getActiveAccount(
  userId: string,
  searchParams?: AccountSearchParams,
): Promise<ActiveAccountResolution> {
  const accounts = await getUserAccounts(userId);
  const params = searchParams ? await searchParams : undefined;

  const fromUrl = params ? requestedAccountId(params) : null;
  if (fromUrl) {
    const account = await getAccountById(fromUrl, userId);
    if (account && !account.archivedAt) return { account, accounts };
  }

  const jar = await cookies();
  const cookieValue = jar.get(ACTIVE_ACCOUNT_COOKIE)?.value;
  if (cookieValue === ACTIVE_ACCOUNT_ALL) return { account: null, accounts };
  if (cookieValue) {
    const account = await getAccountById(cookieValue, userId);
    if (account && !account.archivedAt) return { account, accounts };
  }

  return { account: accounts[0] ?? null, accounts };
}
