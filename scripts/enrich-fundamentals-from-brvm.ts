// ═══════════════════════════════════════════════════════════════════════════
// Enrichit PER + capitalisation (Mds FCFA) depuis les fiches BRVM.org
// ═══════════════════════════════════════════════════════════════════════════
// Usage : npx ts-node scripts/enrich-fundamentals-from-brvm.ts [TICKER...]
// Sans argument : toutes les sociétés actives (respecte Crawl-delay 10s).
// ═══════════════════════════════════════════════════════════════════════════

import { prisma } from "../lib/prisma";
import { brvmConnector } from "../lib/ingestion/connectors/brvm_connector";
import { persistFinancialRatios } from "../lib/ingestion/persist";

async function main() {
  const only = process.argv.slice(2).map((t) => t.toUpperCase());
  const companies = await prisma.company.findMany({
    where: { isActive: true, ...(only.length ? { ticker: { in: only } } : {}) },
    select: { id: true, ticker: true },
    orderBy: { ticker: "asc" },
  });
  const tickers = companies.map((c) => c.ticker);
  const companyIdByTicker = new Map(companies.map((c) => [c.ticker, c.id]));

  console.log(`→ Fondamentaux BRVM pour ${tickers.length} société(s)…`);
  const result = await brvmConnector.fetchFundamentals(tickers);
  if (!result.ok) {
    console.error("❌", result.error);
    process.exit(1);
  }

  const persisted = await persistFinancialRatios(prisma, result.data, companyIdByTicker);
  for (const row of result.data) {
    console.log(
      `  ${row.ticker}: PER=${row.per ?? "N/D"} · Cap=${row.mktCapMds ?? "N/D"} Mds · Clôture=${row.closePrice ?? "N/D"}`
    );
  }
  console.log(
    `✔ ${persisted.upserted} ratio(s) upserté(s), ${persisted.markedCanonical} canonique(s)` +
      (persisted.unknownTickers.length ? ` · inconnus: ${persisted.unknownTickers.join(", ")}` : "")
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
