// ═══════════════════════════════════════════════════════════════════════════
// GET /api/market/summary — Indices du jour + top hausses/baisses
// ═══════════════════════════════════════════════════════════════════════════
// Étape 4 du plan de migration.
//
// ⚠️ Tant que le cron d'ingestion multi-source (étape 6) n'est pas en place,
// les tables `market_indices`/`market_index_values` ne sont peuplées que par
// des runs manuels du prototype (étape 3, `npm run ingest:prototype`) qui
// n'écrit PAS encore en base — cette route retournera donc `indices: []`
// jusqu'à l'étape 6. C'est un comportement ATTENDU, pas un bug : l'endpoint
// est conçu et testé dès maintenant pour ne pas avoir à le retoucher ensuite.
//
// "Top hausses/baisses" : variation de la dernière séance de bourse contre
// la séance précédente (ligne canonique ou, à défaut, source prioritaire),
// ou la variation officielle publiée. Les cours sont ajustés des fractionnements.
// ═══════════════════════════════════════════════════════════════════════════

import { prisma } from "@/lib/prisma";
import { apiSuccess, cacheHeaders } from "@/lib/api/response";
import { closeForSession, sessionDayChangePercent, type SessionCloseRow } from "@/lib/api/session-day-change";
import { loadRecentIndexLevels } from "@/lib/api/market-summary-snapshot";
import { isHeadlineIndex } from "@/lib/markets/index-catalog";
import { priceDivisor } from "@/lib/corporate-actions/adjust";
import { actionsByTicker } from "@/lib/corporate-actions/load";
import type { DataSourceCode } from "@/lib/ingestion/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const levels = await loadRecentIndexLevels();
  const headline = levels.filter((row) => isHeadlineIndex(row.code));
  const otherIndices = levels.filter((row) => !isHeadlineIndex(row.code));

  // Top hausses / baisses : séance précédente réelle (canonique ou non).
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, ticker: true, name: true, color: true },
  });
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 21);
  const priceRows = await prisma.priceHistory.findMany({
    where: { companyId: { in: companies.map((c) => c.id) }, date: { lte: now, gte: from } },
    orderBy: [{ companyId: "asc" }, { date: "desc" }],
    select: {
      companyId: true,
      date: true,
      closePrice: true,
      changePercent: true,
      source: true,
      isCanonical: true,
    },
  });
  const actions = await actionsByTicker().catch(() => new Map());
  const byCompany = new Map<string, SessionCloseRow[]>();
  for (const row of priceRows) {
    const close = Number(row.closePrice);
    if (!(close > 0)) continue;
    const list = byCompany.get(row.companyId) ?? [];
    list.push({
      date: row.date.toISOString().slice(0, 10),
      close,
      source: row.source as DataSourceCode,
      changePercent: row.changePercent != null ? Number(row.changePercent) : null,
      isCanonical: row.isCanonical,
    });
    byCompany.set(row.companyId, list);
  }

  const movers = companies
    .map((c) => {
      const list = byCompany.get(c.id) ?? [];
      if (list.length === 0) return null;
      const changePercent = sessionDayChangePercent(list, actions.get(c.ticker) ?? []);
      if (changePercent == null) return null;
      const dates = [...new Set(list.map((row) => row.date.slice(0, 10)))].sort();
      const last = closeForSession(list, dates[dates.length - 1]!);
      if (!last) return null;
      const divisor = priceDivisor(actions.get(c.ticker) ?? [], last.date);
      return {
        ticker: c.ticker,
        name: c.name,
        color: c.color,
        price: Math.round((last.close / divisor) * 100) / 100,
        date: last.date.slice(0, 10),
        changePercent,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const topGainers = [...movers].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
  const topLosers = [...movers].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);

  return apiSuccess(
    {
      headlineIndices: headline,
      otherIndices,
      topGainers,
      topLosers,
      asOf: new Date().toISOString(),
    },
    { headers: cacheHeaders(30) }
  );
}
