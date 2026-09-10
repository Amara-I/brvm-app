// Décanonise les cours dont la date est dans le futur (ex. proxy 31/12 année
// en cours) pour qu'ils n'écrasent plus le dernier vrai cours du jour.
// Usage : npx ts-node scripts/decanonicalize-future-prices.ts

import { prisma } from "../lib/prisma";

async function main() {
  const now = new Date();
  const result = await prisma.priceHistory.updateMany({
    where: { isCanonical: true, date: { gt: now } },
    data: { isCanonical: false },
  });
  console.log(`✔ Décanonisé ${result.count} cours futur(s) (date > ${now.toISOString().slice(0, 10)})`);
}

main()
  .catch((err) => {
    console.error("❌", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
