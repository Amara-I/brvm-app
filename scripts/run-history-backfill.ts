// ═══════════════════════════════════════════════════════════════════════════
// Backfill historique maximal (Sikafinance GetHistos + fiches + events)
// ═══════════════════════════════════════════════════════════════════════════
// Usage :
//   npm run history:sika-full
//   npx ts-node scripts/run-history-backfill.ts SNTS SGBC
//   npx ts-node scripts/run-history-backfill.ts --daily-from=2015-01-01
//   npx ts-node scripts/run-history-backfill.ts --daily=off --no-events
//   npx ts-node scripts/run-history-backfill.ts --max-tickers=3 --no-resume
//   npx ts-node scripts/run-history-backfill.ts --budget-ms=240000
//
// Nécessite DATABASE_URL. Aucun cours n'est inventé : seules les séries
// réellement renvoyées par GetHistos / les fiches SOCIETE sont persistées.
// Reprend automatiquement au ticker suivant si un run précédent a été
// interrompu (ingestion_logs.kind = HISTORY_BACKFILL).

import { prisma } from "../lib/prisma";
import { runHistoryBackfill, type HistoryBackfillOptions } from "../lib/ingestion/run-history-backfill";

function parseArgs(argv: string[]): HistoryBackfillOptions {
  const flags = argv.filter((a) => a.startsWith("--"));
  const tickers = argv.filter((a) => !a.startsWith("--")).map((t) => t.toUpperCase());
  const get = (name: string) => flags.find((f) => f.startsWith(`${name}=`))?.split("=")[1];

  const dailyRaw = get("--daily-from") ?? get("--daily");
  let dailyFrom: HistoryBackfillOptions["dailyFrom"];
  if (dailyRaw === "off" || dailyRaw === "false") dailyFrom = "off";
  else if (dailyRaw === "auto") dailyFrom = "auto";
  else if (dailyRaw && /^\d{4}-\d{2}-\d{2}$/.test(dailyRaw)) dailyFrom = dailyRaw;
  else dailyFrom = "auto";

  const budget = Number(get("--budget-ms"));
  const maxTickers = Number(get("--max-tickers"));
  const annualFrom = Number(get("--annual-from"));

  return {
    tickers: tickers.length ? tickers : undefined,
    dailyFrom,
    includeAnnual: !flags.includes("--no-annual"),
    includeMonthly: !flags.includes("--no-monthly"),
    includeDaily: dailyFrom !== "off" && !flags.includes("--no-daily"),
    includeSheets: !flags.includes("--no-sheets"),
    includeEventsNews: !flags.includes("--no-events"),
    includeDocuments: !flags.includes("--no-docs"),
    timeBudgetMs: Number.isFinite(budget) && budget > 0 ? budget : undefined,
    maxTickers: Number.isFinite(maxTickers) && maxTickers >= 0 ? Math.floor(maxTickers) : undefined,
    annualFromYear: Number.isFinite(annualFrom) && annualFrom >= 1990 ? Math.floor(annualFrom) : undefined,
    resume: !flags.includes("--no-resume"),
    resumeAfterTicker: get("--after")?.toUpperCase(),
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL manquant — le backfill n'écrit rien sans PostgreSQL.");
    process.exit(2);
  }

  const options = parseArgs(process.argv.slice(2));
  const summary = await runHistoryBackfill(options);

  console.log(
    `\n✔ ${summary.tickersOk}/${summary.tickersAttempted} ticker(s)` +
      ` · upsert=${summary.pricesUpserted} canoniques=${summary.pricesCanonical}` +
      ` · ${summary.durationMs}ms` +
      (summary.incomplete ? ` · INCOMPLET next=${summary.nextTicker ?? "?"}` : "")
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
