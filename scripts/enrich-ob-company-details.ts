// Backfill rapide des détails émetteur (industrie, DG, présidence, IPO, site)
// depuis `brvm_company_profiles` (OuestBourse Supabase).
// Usage : npx ts-node scripts/enrich-ob-company-details.ts [TICKER ...]

import { prisma } from "../lib/prisma";
import {
  fetchOuestbourseCompanyProfile,
  isOuestbourseSupabaseConfigured,
  obCompanyProfileToRaw,
} from "../lib/ingestion/connectors/ouestbourse_supabase";
import { persistCompanyProfiles } from "../lib/ingestion/persist";

async function main() {
  if (!isOuestbourseSupabaseConfigured()) {
    throw new Error("OUESTBOURSE_SUPABASE_ANON_KEY manquant");
  }
  const only = process.argv.slice(2).map((t) => t.toUpperCase());
  const companies = await prisma.company.findMany({
    where: { isActive: true, ...(only.length ? { ticker: { in: only } } : {}) },
    select: { id: true, ticker: true },
    orderBy: { ticker: "asc" },
  });
  const companyIdByTicker = new Map(companies.map((c) => [c.ticker, c.id]));

  console.log(`→ Détails OB — ${companies.length} société(s)`);
  let ok = 0;
  let empty = 0;
  let fail = 0;

  for (const co of companies) {
    try {
      const row = await fetchOuestbourseCompanyProfile(co.ticker);
      if (!row) {
        empty++;
        console.log(`  ${co.ticker}: ∅`);
        continue;
      }
      await persistCompanyProfiles(prisma, [obCompanyProfileToRaw(co.ticker, row)], companyIdByTicker);
      ok++;
      console.log(
        `  ${co.ticker}: ${row.industry ?? "N/D"} · DG=${row.ceo ?? "N/D"} · IPO=${row.listing_date ?? "N/D"} · ${row.website ?? "N/D"}`
      );
    } catch (e) {
      fail++;
      console.warn(`  ${co.ticker}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`✔ OK=${ok} vides=${empty} échecs=${fail}`);
}

main()
  .catch((err) => {
    console.error("❌", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
