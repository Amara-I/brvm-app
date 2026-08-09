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
// "Top hausses/baisses" : calculé à partir des DEUX points de cours
// CANONIQUES les plus récents de chaque société. Avec les données seedées
// (étape 2, un point par année), cela reflète une variation annuelle plutôt
// que journalière — cela deviendra une vraie variation quotidienne dès que
// le cron alimentera `price_history` au jour le jour (étape 6).
// ═══════════════════════════════════════════════════════════════════════════

import { prisma } from "@/lib/prisma";
import { apiSuccess, cacheHeaders } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/// Codes des indices à mettre en avant en tête de réponse (les autres
/// indices sectoriels, s'ils existent, sont retournés dans `otherIndices`).
const HEADLINE_INDEX_CODES = ["BRVM_COMPOSITE", "BRVM_30"];

export async function GET() {
  const indices = await prisma.marketIndex.findMany({
    include: {
      values: {
        where: { isCanonical: true },
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  const serializedIndices = indices
    .filter((idx) => idx.values.length > 0)
    .map((idx) => ({
      code: idx.code,
      name: idx.name,
      value: Number(idx.values[0].value),
      changePercent: idx.values[0].changePercent !== null ? Number(idx.values[0].changePercent) : null,
      date: idx.values[0].date.toISOString().slice(0, 10),
      source: idx.values[0].source,
    }));

  const headline = serializedIndices.filter((i) => HEADLINE_INDEX_CODES.includes(i.code));
  const otherIndices = serializedIndices.filter((i) => !HEADLINE_INDEX_CODES.includes(i.code));

  // Top hausses / baisses : dernier + avant-dernier cours canonique par société.
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, ticker: true, name: true, color: true },
  });
  const priceRows = await prisma.priceHistory.findMany({
    where: { companyId: { in: companies.map((c) => c.id) }, isCanonical: true },
    orderBy: [{ companyId: "asc" }, { date: "desc" }],
  });

  const byCompany = new Map<string, typeof priceRows>();
  for (const row of priceRows) {
    const list = byCompany.get(row.companyId) ?? [];
    if (list.length < 2) list.push(row);
    byCompany.set(row.companyId, list);
  }

  const movers = companies
    .map((c) => {
      const [latest, previous] = byCompany.get(c.id) ?? [];
      if (!latest || !previous) return null;
      const changePercent = ((Number(latest.closePrice) - Number(previous.closePrice)) / Number(previous.closePrice)) * 100;
      return {
        ticker: c.ticker,
        name: c.name,
        color: c.color,
        price: Number(latest.closePrice),
        date: latest.date.toISOString().slice(0, 10),
        changePercent: Math.round(changePercent * 100) / 100,
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
