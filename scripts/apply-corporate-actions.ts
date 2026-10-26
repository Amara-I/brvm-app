// Applique le catalogue de fractionnements et reconstruit chart_series.
// Idempotent. Ne réécrit pas price_history ni les quantités de portefeuille.
//
//   npm run corporate-actions:apply
//   npx ts-node scripts/apply-corporate-actions.ts SNTS --budget-ms=60000
//
// Prod (après `prisma migrate deploy` sur Supabase) :
//   npm run corporate-actions:apply
// ou
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "https://<host>/api/cron/corporate-actions?budgetMs=240000"

import { prisma } from "../lib/prisma";
import { applyCorporateActions } from "../lib/corporate-actions/apply-run";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL manquant");
    process.exit(2);
  }
  const argv = process.argv.slice(2);
  const flags = argv.filter((arg) => arg.startsWith("--"));
  const tickers = argv.filter((arg) => !arg.startsWith("--")).map((ticker) => ticker.toUpperCase());
  const budget = Number(flags.find((flag) => flag.startsWith("--budget-ms="))?.split("=")[1]);
  const summary = await applyCorporateActions({
    tickers: tickers.length ? tickers : undefined,
    timeBudgetMs: Number.isFinite(budget) && budget > 0 ? budget : undefined,
    verifyHistory: true,
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
