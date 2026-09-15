// Rebuild CLI des séries graphes précalculées.
//   npx ts-node scripts/refresh-chart-series.ts
//   npx ts-node scripts/refresh-chart-series.ts SNTS SGBC --budget-ms=20000

import { prisma } from "../lib/prisma";
import { refreshChartSeries } from "../lib/charts/refresh-chart-series";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL manquant");
    process.exit(2);
  }
  const argv = process.argv.slice(2);
  const flags = argv.filter((a) => a.startsWith("--"));
  const symbols = argv.filter((a) => !a.startsWith("--")).map((s) => s.toUpperCase());
  const budget = Number(flags.find((f) => f.startsWith("--budget-ms="))?.split("=")[1]);
  const summary = await refreshChartSeries({
    symbols: symbols.length ? symbols : undefined,
    timeBudgetMs: Number.isFinite(budget) && budget > 0 ? budget : undefined,
  });
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error("❌", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
