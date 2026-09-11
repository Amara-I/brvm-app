// Backfill journalier Sikafinance depuis 2024-01-01 (détail graphes).
// Délègue à l'orchestrateur unique.
// Usage : npx ts-node scripts/backfill-sika-daily-from-2024.ts [TICKER...]

import { prisma } from "../lib/prisma";
import { runHistoryBackfill } from "../lib/ingestion/run-history-backfill";

const DAILY_FROM = "2024-01-01";

async function main() {
  const only = process.argv.slice(2).map((t) => t.toUpperCase()).filter(Boolean);
  await runHistoryBackfill({
    tickers: only.length ? only : undefined,
    dailyFrom: DAILY_FROM,
    includeAnnual: false,
    includeMonthly: false,
    includeDaily: true,
    includeSheets: false,
    includeEventsNews: false,
    includeDocuments: false,
    resume: false,
  });
}

main()
  .catch((err) => {
    console.error("❌", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
