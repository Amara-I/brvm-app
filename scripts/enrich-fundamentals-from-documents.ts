// Fondamentaux issus des documents BRVM (extraits OB : screener + financials_annual).
// Usage :
//   npm run enrich:fundamentals-docs
//   npx ts-node scripts/enrich-fundamentals-from-documents.ts SNTS

import { prisma } from "../lib/prisma";
import {
  fetchOuestbourseFinancialsAnnual,
  fetchOuestbourseScreenerMetrics,
  isOuestbourseSupabaseConfigured,
  obFinancialsToFundamentals,
} from "../lib/ingestion/connectors/ouestbourse_supabase";
import { persistFinancialRatios } from "../lib/ingestion/persist";

async function main() {
  if (!isOuestbourseSupabaseConfigured()) {
    console.error("❌ OUESTBOURSE_SUPABASE_ANON_KEY manquant");
    process.exit(1);
  }

  const only = process.argv.slice(2).map((t) => t.toUpperCase());
  const companies = await prisma.company.findMany({
    where: { isActive: true, ...(only.length ? { ticker: { in: only } } : {}) },
    select: { id: true, ticker: true },
    orderBy: { ticker: "asc" },
  });
  const companyIdByTicker = new Map(companies.map((c) => [c.ticker, c.id]));

  console.log(`→ Fondamentaux documents BRVM/OB — ${companies.length} société(s)`);
  let ok = 0;
  let fail = 0;

  for (const co of companies) {
    try {
      const [screeners, annuals] = await Promise.all([
        fetchOuestbourseScreenerMetrics(co.ticker),
        fetchOuestbourseFinancialsAnnual(co.ticker),
      ]);
      const fundamentals = obFinancialsToFundamentals(
        co.ticker,
        screeners[0] ?? null,
        annuals
      );
      if (fundamentals.length === 0) {
        console.log(`  ${co.ticker}: aucune donnée documentaire`);
        ok++;
        continue;
      }
      const r = await persistFinancialRatios(prisma, fundamentals, companyIdByTicker);
      const sample = fundamentals
        .map(
          (f) =>
            `${f.year}[ca=${f.revenue ?? "·"} rn=${f.netIncome ?? "·"} rex=${f.operatingIncome ?? "·"}]`
        )
        .join(" ");
      console.log(`  ${co.ticker}: +${r.upserted} · ${sample}`);
      ok++;
    } catch (e) {
      fail++;
      console.warn(`  ${co.ticker}: ✗ ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`✔ OK=${ok} échecs=${fail}`);
}

main()
  .catch((err) => {
    console.error("❌", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
