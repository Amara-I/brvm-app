// Met à jour les cours 2026 de prisma/seed-data/companies-full.ts à partir
// du dernier cours canonique NON FUTUR en base (typiquement après
// `npm run ingest:run`). Usage : npx ts-node scripts/sync-seed-prices-from-db.ts

import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const prisma = new PrismaClient();
  const companies = await prisma.company.findMany({ select: { ticker: true, id: true } });
  const now = new Date();
  const prices = new Map<string, number>();

  for (const co of companies) {
    const row = await prisma.priceHistory.findFirst({
      where: { companyId: co.id, isCanonical: true, date: { lte: now } },
      orderBy: { date: "desc" },
    });
    if (row) prices.set(co.ticker, Number(row.closePrice));
  }
  await prisma.$disconnect();

  const path = join(__dirname, "..", "prisma", "seed-data", "companies-full.ts");
  let src = readFileSync(path, "utf8");
  let updated = 0;

  for (const [ticker, price] of prices) {
    const re = new RegExp(`(ticker: "${ticker}"[\\s\\S]*?prices: \\{[\\s\\S]*?)(2026: )(\\d+(?:\\.\\d+)?)`);
    if (!re.test(src)) {
      console.warn(`Pas de match pour ${ticker}`);
      continue;
    }
    const next = src.replace(re, `$1$2${price}`);
    if (next !== src) {
      updated++;
      src = next;
    }
  }

  writeFileSync(path, src, "utf8");
  console.log(`✔ ${updated}/${prices.size} cours 2026 mis à jour dans companies-full.ts (ex. SNTS=${prices.get("SNTS")})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
