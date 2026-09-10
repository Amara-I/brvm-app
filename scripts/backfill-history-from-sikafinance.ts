// ═══════════════════════════════════════════════════════════════════════════
// Backfill historique annuel depuis Sikafinance (POST /api/general/GetHistos)
// ═══════════════════════════════════════════════════════════════════════════
// Pour chaque société active : récupère la série annuelle, upsert les années
// manquantes en source SIKAFINANCE. Ne remplace jamais un cours BRVM_OFFICIEL
// déjà présent pour la même année.
//
// Usage :
//   npm run history:sikafinance
//   npx ts-node scripts/backfill-history-from-sikafinance.ts SNTS ABJC
// ═══════════════════════════════════════════════════════════════════════════

import { DataSource } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sikafinanceConnector } from "../lib/ingestion/connectors/sikafinance_connector";
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

  console.log(`→ Backfill Sikafinance — historique annuel pour ${companies.length} société(s)…`);

  const companyIdByTicker = new Map(companies.map((c) => [c.ticker, c.id]));
  const allQuotes: RawPriceQuote[] = [];
  let okCount = 0;
  let failCount = 0;

  for (const co of companies) {
    const result = await sikafinanceConnector.fetchAnnualHistory(co.ticker, 1998);
    if (!result.ok) {
      failCount++;
      console.warn(`  ${co.ticker}: échec — ${result.error}`);
      continue;
    }

    let added = 0;
    for (const q of result.data) {
      const year = Number(q.date.slice(0, 4));
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

      allQuotes.push(q);
      added++;
    }

    okCount++;
    const years = [...new Set(result.data.map((q) => q.date.slice(0, 4)))].sort();
    console.log(
      `  ${co.ticker}: série ${result.data.length} an(s)` +
        (years.length ? ` [${years[0]}–${years[years.length - 1]}]` : "") +
        ` · +${added} à insérer`
    );
  }

  if (allQuotes.length === 0) {
    console.log(`✔ Rien à ajouter (${okCount} OK, ${failCount} échecs) — historique déjà couvert ou indisponible.`);
    return;
  }

  const { reconciled } = reconcilePriceBatch(allQuotes);
  const filtered = [];
  for (const r of reconciled) {
    const companyId = companyIdByTicker.get(r.ticker);
    if (!companyId) continue;
    const date = new Date(`${r.date}T00:00:00.000Z`);
    const brvmExists = await prisma.priceHistory.findFirst({
      where: { companyId, date, source: DataSource.BRVM_OFFICIEL },
      select: { id: true },
    });
    if (brvmExists && r.resolvedSource !== "BRVM_OFFICIEL") continue;
    filtered.push(r);
  }

  const persist = await persistPriceQuotes(prisma, allQuotes, filtered, companyIdByTicker);
  console.log(
    `✔ upsert=${persist.upserted} canoniques=${persist.markedCanonical}` +
      ` · séries OK=${okCount} échecs=${failCount}` +
      (persist.unknownTickers.length ? ` · inconnus: ${persist.unknownTickers.join(", ")}` : "")
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
