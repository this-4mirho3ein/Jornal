import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/guards";
import { tradesToCsv } from "@/features/trades/csv";
import { getTradesForExport, resolveTradesView } from "@/features/trades/queries";

/**
 * GET /api/trades/export — CSV of the currently filtered trades set (§11).
 * Same query builder + account resolution as the page, so what you see is
 * exactly what downloads. Signed-out users hit the login redirect (`Route
 * Handlers` may throw `redirect()`); the key never touches this endpoint.
 */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const view = await resolveTradesView(user.id, searchParams);
  // Same rule as the trades page (owner decision 2026-11): exports are
  // per-account — no selected account ("All accounts" mode) exports nothing.
  if (view.accountId === null) {
    return NextResponse.json(
      { error: "Select an account first — the CSV export is per-account." },
      { status: 409 },
    );
  }
  const filters = view.filters;
  const rows = await getTradesForExport(user.id, filters);
  const csv = tradesToCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="trades-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
