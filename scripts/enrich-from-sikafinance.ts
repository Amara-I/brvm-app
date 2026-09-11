// ═══════════════════════════════════════════════════════════════════════════
// Enrichissement multi-onglets Sikafinance (HISTORIQUES + SOCIETE)
// ═══════════════════════════════════════════════════════════════════════════
// Délègue à `runHistoryBackfill` (annuel + mensuel + journalier + fiche).
// Events / documents : npm run history:sika-full ou enrich:company-meta.
//
// Usage :
//   npm run enrich:sikafinance
//   npx ts-node scripts/enrich-from-sikafinance.ts SNTS ABJC
//   npx ts-node scripts/enrich-from-sikafinance.ts --daily-years=3
//   npx ts-node scripts/enrich-from-sikafinance.ts --daily-from=2024-01-01

import { prisma } from "../lib/prisma";
import { runHistoryBackfill } from "../lib/ingestion/run-history-backfill";
import { toIsoDate } from "../lib/ingestion/parse-utils";

function parseDailyYears(argv: string[]): number {
  const flag = argv.find((a) => a.startsWith("--daily-years="));
  if (!flag) return 3;
  const n = Number(flag.split("=")[1]);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? Math.floor(n) : 3;
}

function parseDailyFrom(argv: string[], dailyYears: number): string | "off" {
  const flag = argv.find((a) => a.startsWith("--daily-from="));
  if (flag) {
    const iso = flag.split("=")[1]?.trim() ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  }
  if (dailyYears <= 0) return "off";
  const from = new Date();
  from.setUTCFullYear(from.getUTCFullYear() - dailyYears);
  return toIsoDate(from);
}

async function main() {
  const argv = process.argv.slice(2);
  const dailyYears = parseDailyYears(argv);
  const dailyFrom = parseDailyFrom(argv, dailyYears);
  const only = argv.filter((a) => !a.startsWith("--")).map((t) => t.toUpperCase());

  await runHistoryBackfill({
    tickers: only.length ? only : undefined,
    dailyFrom,
    includeAnnual: true,
    includeMonthly: true,
    includeDaily: dailyFrom !== "off",
    includeSheets: true,
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
