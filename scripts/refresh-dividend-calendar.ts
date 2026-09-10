// Actualisation rapide calendrier (BRVM + Sika à venir, sans fiches société).
import { prisma } from "../lib/prisma";
import { runDividendsRefresh } from "../lib/ingestion/run-dividends-refresh";

async function main() {
  console.log("→ Actualisation calendrier dividendes…");
  const result = await runDividendsRefresh(prisma, { skipSikafinance: true });
  console.log(JSON.stringify(result, null, 2));
  const dated = await prisma.dividend.count({
    where: {
      isCanonical: true,
      OR: [{ exDate: { not: null } }, { paymentDate: { not: null } }],
    },
  });
  const total = await prisma.dividend.count({ where: { isCanonical: true } });
  console.log(`✔ Calendrier : ${total} dividendes canoniques · ${dated} avec dates`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
