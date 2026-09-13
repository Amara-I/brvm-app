// Backfill historique + composition des indices BRVM.
// Usage :
//   npm run history:indices
//   npx ts-node scripts/run-index-enrichment.ts --codes=BRVM_COMPOSITE,BRVM_30
//   npx ts-node scripts/run-index-enrichment.ts --daily-from=2025-07-01 --no-annual
//   npx ts-node scripts/run-index-enrichment.ts --composition-only
//   npx ts-node scripts/run-index-enrichment.ts --force
//
// Nécessite DATABASE_URL. Aucun niveau inventé : GetHistos Sika + avis BRVM.

import { prisma } from "../lib/prisma";
import { runIndexEnrichment, type IndexEnrichmentOptions } from "../lib/ingestion/run-index-enrichment";

function parseArgs(argv: string[]): IndexEnrichmentOptions {
  const flags = argv.filter((a) => a.startsWith("--"));
  const get = (name: string) => flags.find((f) => f.startsWith(`${name}=`))?.split("=")[1];
  const codesRaw = get("--codes");
  const dailyFrom = get("--daily-from");
  const annualFrom = Number(get("--annual-from"));
  const budget = Number(get("--budget-ms"));
  const compositionOnly = flags.includes("--composition-only");
  const historyOnly = flags.includes("--history-only");

  return {
    codes: codesRaw ? codesRaw.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean) : undefined,
    includeComposition: compositionOnly || !historyOnly,
    includeHistory: historyOnly || !compositionOnly,
    includeAnnual: !flags.includes("--no-annual") && !compositionOnly,
    includeMonthly: !flags.includes("--no-monthly") && !compositionOnly,
    includeDaily: !flags.includes("--no-daily") && !compositionOnly,
    dailyFrom: dailyFrom && /^\d{4}-\d{2}-\d{2}$/.test(dailyFrom) ? dailyFrom : undefined,
    annualFromYear: Number.isFinite(annualFrom) && annualFrom >= 1990 ? Math.floor(annualFrom) : undefined,
    timeBudgetMs: Number.isFinite(budget) && budget > 0 ? budget : undefined,
    force: flags.includes("--force"),
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL manquant — rien n'est écrit sans PostgreSQL.");
    process.exit(2);
  }

  const summary = await runIndexEnrichment(parseArgs(process.argv.slice(2)));
  console.log(
    `\n✔ composition=${summary.compositionUpserted}` +
      ` · indices ${summary.codesOk}/${summary.codesAttempted}` +
      ` · upsert=${summary.historyUpserted}` +
      ` · ${summary.durationMs}ms` +
      (summary.incomplete ? " · INCOMPLET" : "")
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
