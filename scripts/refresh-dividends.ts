// Actualise dividendes : calendrier BRVM.org + historique annuel Sikafinance.
// Usage : npm run dividends:refresh
//         npx ts-node scripts/refresh-dividends.ts SNTS NEIC

import { prisma } from "../lib/prisma";
import { runDividendsRefresh } from "../lib/ingestion/run-dividends-refresh";

async function main() {
  const only = process.argv.slice(2);
  console.log("→ Actualisation dividendes (BRVM + Sikafinance)…");

  const result = await runDividendsRefresh(prisma, {
    tickers: only.length ? only : undefined,
  });

  if (result.brvm.ok) {
    console.log(
      `  BRVM : ${result.brvm.rows} ligne(s) calendrier · ${result.brvm.upserted} upsert(s)`
    );
  } else {
    console.warn(`  BRVM : échec — ${result.brvm.error}`);
  }

  try {
    const { revalidateDividendCalendarCache } = await import("../lib/api/revalidate-market-cache");
    revalidateDividendCalendarCache();
  } catch {
    /* hors contexte Next.js (CLI) */
  }

  console.log(
    `  Sikafinance : OK=${result.sikafinance.ok} échecs=${result.sikafinance.fail}` +
      ` · ${result.sikafinance.upserted} upsert(s)`
  );
  console.log(
    `  Sika à venir : ${result.sikaUpcoming.rows} ligne(s) · ${result.sikaUpcoming.datesApplied} date(s) appliquée(s)`
  );
  if (result.richbourse.ok) {
    console.log(
      `  Richbourse : ${result.richbourse.rows} ligne(s) · ${result.richbourse.upserted} upsert(s)`
    );
  } else if (result.richbourse.error) {
    console.warn(`  Richbourse : échec — ${result.richbourse.error}`);
  }
  console.log(`  Sync dates canoniques : ${result.datesSynced} mise(s) à jour`);

  if (result.unknownIssuers.length) {
    console.warn(`  Émetteurs BRVM non mappés : ${result.unknownIssuers.join(", ")}`);
  }

  const dated = await prisma.dividend.count({
    where: {
      isCanonical: true,
      OR: [{ exDate: { not: null } }, { paymentDate: { not: null } }],
    },
  });
  const total = await prisma.dividend.count({ where: { isCanonical: true } });
  console.log(`✔ Dividendes canoniques : ${total} (${dated} avec date ex/paiement)`);
}

main()
  .catch((err) => {
    console.error("❌", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
