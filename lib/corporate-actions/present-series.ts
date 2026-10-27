// Série affichable : cours canoniques bruts + impression post-split éventuelle,
// puis facteur. `chart_series` stocke le résultat avec `adjustmentFingerprint`
// pour ne pas réappliquer le facteur au prochain read.

import type { PrismaClient } from "@prisma/client";
import type { ChartClosePoint } from "@/lib/charts/indicators";
import {
  adjustSeries,
  adjustmentFingerprint,
  mergeSplitSessionQuotes,
  type SessionQuote,
} from "./adjust";
import { actionsForTicker } from "./load";
import type { AdjustmentAction } from "./types";

const SOURCE_RANK: Record<string, number> = {
  BRVM_OFFICIEL: 0,
  NGX_OFFICIEL: 1,
  SIKAFINANCE: 2,
  OUESTBOURSE: 3,
  RICHBOURSE: 4,
  MANUEL: 5,
};

export interface PresentedSeries {
  points: ChartClosePoint[];
  actions: AdjustmentAction[];
  fingerprint: string;
}

export async function presentCompanyCloses(
  db: PrismaClient,
  companyId: string,
  ticker: string,
  canonical: ChartClosePoint[]
): Promise<PresentedSeries> {
  const actions = await actionsForTicker(ticker, companyId);
  const fingerprint = adjustmentFingerprint(actions);
  if (fingerprint === "none") {
    return { points: canonical, actions, fingerprint };
  }

  const earliest = actions
    .filter((action) => action.adjustPrices)
    .map((action) => action.effectiveDate)
    .sort()[0];
  let merged = canonical;
  if (earliest) {
    const from = new Date(`${earliest}T00:00:00.000Z`);
    from.setUTCDate(from.getUTCDate() - 10);
    try {
      const extras = await db.priceHistory.findMany({
        where: {
          companyId,
          isCanonical: false,
          date: { gte: from, lte: new Date() },
        },
        orderBy: { date: "asc" },
        select: { date: true, closePrice: true, volume: true, source: true },
      });
      const quotes: SessionQuote[] = extras.map((row) => ({
        time: row.date.toISOString().slice(0, 10),
        value: Number(row.closePrice),
        volume: row.volume != null ? Number(row.volume) : null,
        canonical: false,
        sourceRank: SOURCE_RANK[row.source] ?? 9,
      }));
      merged = mergeSplitSessionQuotes(canonical, quotes, actions);
    } catch {
      merged = canonical;
    }
  }

  return { points: adjustSeries(merged, actions), actions, fingerprint };
}
