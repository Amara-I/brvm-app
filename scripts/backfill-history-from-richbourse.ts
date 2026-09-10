// ═══════════════════════════════════════════════════════════════════════════
// Complète l'historique annuel depuis Richbourse (série Highcharts)
// ═══════════════════════════════════════════════════════════════════════════
// Pour chaque société active, récupère la série publique Richbourse et upsert
// les clôtures de fin d'année manquantes (source RICHBOURSE). Ne remplace
// jamais un cours BRVM_OFFICIEL déjà présent pour la même année.
//
// Usage :
//   npx ts-node scripts/backfill-history-from-richbourse.ts
//   npx ts-node scripts/backfill-history-from-richbourse.ts SNTS ETIT
// ═══════════════════════════════════════════════════════════════════════════

import { DataSource } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { fetchHtml } from "../lib/ingestion/http-client";
import { yearEndClosesFromHighcharts } from "../lib/ingestion/connectors/richbourse_connector";
import { reconcilePriceBatch } from "../lib/ingestion/reconciliation";
import { persistPriceQuotes } from "../lib/ingestion/persist";
import type { RawPriceQuote } from "../lib/ingestion/types";

async function main() {
  const only = process.argv.slice(2).map((t) => t.toUpperCase());
  const companies = await prisma.company.findMany({
    where: { isActive: true, ...(only.length ? { ticker: { in: only } } : {}) },
    select: { id: true, ticker: true },
    orderBy: { ticker: "asc" },
  });

  console.log(`→ Backfill Richbourse — historique annuel pour ${companies.length} société(s)…`);

  const companyIdByTicker = new Map(companies.map((c) => [c.ticker, c.id]));
  const allQuotes: RawPriceQuote[] = [];
  const fetchedAt = new Date().toISOString();
  const today = fetchedAt.slice(0, 10);

  for (const co of companies) {
    const url = `https://www.richbourse.com/common/mouvements/index/${co.ticker}`;
    try {
      const html = await fetchHtml(url, { cacheTtlMs: 60 * 60 * 1000 });
      const byYear = yearEndClosesFromHighcharts(html);
      let n = 0;
      for (const [year, row] of byYear) {
        if (row.date > today) continue;
        if (row.closePrice <= 0 || row.closePrice > 2_000_000) continue;

        const hasBrvm = await prisma.priceHistory.findFirst({
          where: {
            companyId: co.id,
            source: DataSource.BRVM_OFFICIEL,
            date: {
              gte: new Date(`${year}-01-01T00:00:00.000Z`),
              lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
            },
          },
          select: { id: true },
        });
        if (hasBrvm) continue;

        const hasCanonicalYear = await prisma.priceHistory.findFirst({
          where: {
            companyId: co.id,
            isCanonical: true,
            date: {
              gte: new Date(`${year}-01-01T00:00:00.000Z`),
              lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
            },
          },
          select: { id: true },
        });
        if (hasCanonicalYear) continue;

        allQuotes.push({
          ticker: co.ticker,
          closePrice: row.closePrice,
          volume: null,
          source: "RICHBOURSE",
          date: row.date,
          fetchedAt,
        });
        n++;
      }
      console.log(`  ${co.ticker}: +${n} année(s) (série Richbourse ${byYear.size} an(s))`);
    } catch (err) {
      console.warn(`  ${co.ticker}: échec — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (allQuotes.length === 0) {
    console.log("✔ Rien à ajouter — historique déjà couvert.");
    return;
  }

  const { reconciled } = reconcilePriceBatch(allQuotes);
  const filteredReconciled = [];
  for (const r of reconciled) {
    const companyId = companyIdByTicker.get(r.ticker);
    if (!companyId) continue;
    const date = new Date(`${r.date}T00:00:00.000Z`);
    const brvmExists = await prisma.priceHistory.findFirst({
      where: { companyId, date, source: DataSource.BRVM_OFFICIEL },
      select: { id: true },
    });
    if (brvmExists && r.resolvedSource !== "BRVM_OFFICIEL") continue;
    filteredReconciled.push(r);
  }

  const result = await persistPriceQuotes(prisma, allQuotes, filteredReconciled, companyIdByTicker);
  console.log(
    `✔ upsert=${result.upserted} canoniques=${result.markedCanonical}` +
      (result.unknownTickers.length ? ` · inconnus: ${result.unknownTickers.join(", ")}` : "")
  );
}

main()
  .catch((err) => {
    console.error("❌", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
