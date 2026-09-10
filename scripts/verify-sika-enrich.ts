import { prisma } from "../lib/prisma";

async function main() {
  const prices = await prisma.priceHistory.count();
  const sika = await prisma.priceHistory.count({ where: { source: "SIKAFINANCE" } });
  const isin = await prisma.company.count({ where: { isin: { not: null } } });
  const desc = await prisma.company.count({ where: { description: { not: null } } });
  const ratios = await prisma.financialRatio.count({ where: { source: "SIKAFINANCE" } });
  const divs = await prisma.dividend.count({ where: { source: "SIKAFINANCE" } });
  console.log({ prices, sika, isin, desc, ratios, divs });
}

main()
  .finally(() => prisma.$disconnect());
