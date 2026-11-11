// Chargement serveur de la vue d'ensemble NGX (base uniquement, rien n'est inventé).

import { getMarketSummarySnapshot } from "@/lib/api/market-summary-snapshot";
import type { TFunc } from "@/lib/i18n/create-i18n";
import { loadNgxOverview } from "@/lib/markets/ngx-browse";
import {
  kpisFromBoardRows,
  orderNgxIndices,
  toNgxBoardRows,
  type NgxOverviewBoardPayload,
} from "@/lib/markets/ngx-overview-board";
import { loadNgxScreener } from "@/lib/markets/ngx-screener";

export async function loadNgxOverviewBoard(t: TFunc): Promise<NgxOverviewBoardPayload> {
  const [overview, screener, summary] = await Promise.all([
    loadNgxOverview().catch(() => null),
    loadNgxScreener({ withSparks: true }).catch(() => null),
    getMarketSummarySnapshot("NGX").catch(() => null),
  ]);
  const shares = overview?.shares ?? [];
  const rows = toNgxBoardRows(shares, screener, t);
  const indices = orderNgxIndices([
    ...(summary?.headlineIndices ?? []),
    ...(summary?.otherIndices ?? []),
  ]);
  return {
    rows,
    sessionDate: overview?.sessionDate ?? null,
    kpis: kpisFromBoardRows(rows),
    indices,
    sourceLabel: shares[0]?.sourceLabel ?? null,
  };
}
