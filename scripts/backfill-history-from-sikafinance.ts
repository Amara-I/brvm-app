// ═══════════════════════════════════════════════════════════════════════════
// Backfill historique annuel depuis Sikafinance (POST /api/general/GetHistos)
// ═══════════════════════════════════════════════════════════════════════════
// Délègue à l'orchestrateur unique `runHistoryBackfill` (annuel uniquement).
// Usage :
//   npm run history:sikafinance
//   npx ts-node scripts/backfill-history-from-sikafinance.ts SNTS ABJC

import { prisma } from "../lib/prisma";
import { runHistoryBackfill } from "../lib/ingestion/run-history-backfill";

async function main() {
  const only = process.argv.slice(2).map((t) => t.toUpperCase()).filter((t) => !t.startsWith("--"));
  await runHistoryBackfill({
    tickers: only.length ? only : undefined,
    includeAnnual: true,
    includeMonthly: false,
    includeDaily: false,
    dailyFrom: "off",
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
