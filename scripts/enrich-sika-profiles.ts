// Enrichissement profil SOCIETE uniquement (rapide) — Sikafinance.
// Usage : npm run enrich:sika-profiles
//         npx ts-node scripts/enrich-sika-profiles.ts SNTS NSBC

import { prisma } from "../lib/prisma";
import { sikafinanceConnector } from "../lib/ingestion/connectors/sikafinance_connector";
import {
  persistCompanyProfiles,
  persistDividendRows,
  persistFinancialRatios,
} from "../lib/ingestion/persist";

async function main() {
  const only = process.argv.slice(2).map((t) => t.toUpperCase());
  const companies = await prisma.company.findMany({
    where: { isActive: true, ...(only.length ? { ticker: { in: only } } : {}) },
    select: { id: true, ticker: true },
    orderBy: { ticker: "asc" },
  });
  const companyIdByTicker = new Map(companies.map((c) => [c.ticker, c.id]));

  console.log(`→ Profils Sikafinance — ${companies.length} société(s)`);
  let ok = 0;
  let fail = 0;

  for (const co of companies) {
    const sheet = await sikafinanceConnector.fetchCompanySheet(co.ticker);
    if (!sheet.ok) {
      fail++;
      console.warn(`  ${co.ticker}: ${sheet.error}`);
      continue;
    }
    const { profile, fundamentals, dividends } = sheet.data;
    const prof = await persistCompanyProfiles(prisma, [profile], companyIdByTicker);
    const ratios = await persistFinancialRatios(prisma, fundamentals, companyIdByTicker);
    const divs = await persistDividendRows(prisma, dividends, companyIdByTicker);
    ok++;
    console.log(
      `  ${co.ticker}: desc=${profile.description ? "oui" : "N/D"}` +
        ` · ISIN=${profile.isin ?? "N/D"}` +
        ` · dir=${profile.directors ? "oui" : "N/D"}` +
        ` · actionnaires=${profile.shareholders.length}` +
        ` · profil+${prof.updated} ratios+${ratios.upserted} div+${divs.upserted}`
    );
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
