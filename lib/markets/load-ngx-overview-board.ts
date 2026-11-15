// Chargement serveur de la vue d'ensemble NGX (base uniquement, rien n'est inventé).

import { getMarketSummarySnapshot } from "@/lib/api/market-summary-snapshot";
import type { TFunc } from "@/lib/i18n/create-i18n";
import { loadNgxOverview, loadNgxOverviewFresh } from "@/lib/markets/ngx-browse";
import {
  kpisFromBoardRows,
  orderNgxIndices,
  toNgxBoardRows,
  type NgxOverviewBoardPayload,
} from "@/lib/markets/ngx-overview-board";
import { loadNgxScreener } from "@/lib/markets/ngx-screener";

/**
 * Vue d'ensemble et notes viennent du cache serveur NGX (10 min, invalidé après
 * chaque ingestion). `fresh: true` relit la base sans cache, juste après une ingestion.
 */
export async function loadNgxOverviewBoard(
  t: TFunc,
  opts: { fresh?: boolean } = {}
): Promise<NgxOverviewBoardPayload> {
  const fresh = opts.fresh === true;
  const [overview, screener, summary] = await Promise.all([
    (fresh ? loadNgxOverviewFresh() : loadNgxOverview()).catch(() => null),
    loadNgxScreener({ withSparks: true, fresh }).catch(() => null),
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
