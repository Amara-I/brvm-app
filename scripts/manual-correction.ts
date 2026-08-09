// ═══════════════════════════════════════════════════════════════════════════
// Fallback manuel de correction de données — étape 6
// ═══════════════════════════════════════════════════════════════════════════
// Répond au brief : "Prévoir un fallback manuel (interface admin simple ou
// script CLI) pour corriger/compléter une donnée si les 3 sources
// échouent". Une interface web d'administration est hors périmètre de cette
// étape (proposée en évolution future) ; ce script CLI couvre le besoin
// immédiat : insérer/corriger une donnée avec `source = MANUEL`, qui devient
// IMMÉDIATEMENT la valeur CANONIQUE pour la clé concernée (toute ligne
// canonique existante pour la même société/date/année est démotée).
//
// Usage :
//   npx ts-node scripts/manual-correction.ts price    <TICKER> <YYYY-MM-DD> <closePrice> [volume]
//   npx ts-node scripts/manual-correction.ts dividend <TICKER> <year> <amount>
//   npx ts-node scripts/manual-correction.ts ratio    <TICKER> <year> [--per=X] [--mktcap=Y]
//
// Exemples :
//   npx ts-node scripts/manual-correction.ts price SNTS 2026-08-08 28500
//   npx ts-node scripts/manual-correction.ts dividend SNTS 2026 1700
//   npx ts-node scripts/manual-correction.ts ratio SNTS 2026 --per=7.5 --mktcap=820
// ═══════════════════════════════════════════════════════════════════════════

import { DataSource, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

async function getCompanyId(ticker: string): Promise<string> {
  const company = await prisma.company.findUnique({ where: { ticker: ticker.toUpperCase() } });
  if (!company) fail(`Société "${ticker}" introuvable en base.`);
  return company.id;
}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    const match = arg.match(/^--([a-zA-Z]+)=(.+)$/);
    if (match) flags[match[1]] = match[2];
  }
  return flags;
}

async function correctPrice(ticker: string, date: string, closePrice: number, volume: number | null) {
  const companyId = await getCompanyId(ticker);
  const dateObj = new Date(`${date}T00:00:00.000Z`);
  const volumeBigInt = volume !== null ? BigInt(Math.round(volume)) : null;

  await prisma.priceHistory.upsert({
    where: { uniq_price_company_date_source: { companyId, date: dateObj, source: DataSource.MANUEL } },
    update: { closePrice, volume: volumeBigInt, isCanonical: true },
    create: { companyId, date: dateObj, source: DataSource.MANUEL, closePrice, volume: volumeBigInt, isCanonical: true },
  });
  // MANUEL devient la SEULE source canonique pour ce point précis — toute
  // autre ligne (BRVM_OFFICIEL, SIKAFINANCE, RICHBOURSE) pour la même
  // (société, date) est démotée sans être supprimée (traçabilité conservée).
  await prisma.priceHistory.updateMany({
    where: { companyId, date: dateObj, source: { not: DataSource.MANUEL } },
    data: { isCanonical: false },
  });
  console.log(`✔ Cours manuel enregistré : ${ticker.toUpperCase()} @ ${date} = ${closePrice} FCFA (source=MANUEL, canonique)`);
}

async function correctDividend(ticker: string, year: number, amount: number) {
  const companyId = await getCompanyId(ticker);
  await prisma.dividend.upsert({
    where: { uniq_dividend_company_year_source: { companyId, year, source: DataSource.MANUEL } },
    update: { amount, isCanonical: true },
    create: { companyId, year, source: DataSource.MANUEL, amount, isCanonical: true },
  });
  await prisma.dividend.updateMany({
    where: { companyId, year, source: { not: DataSource.MANUEL } },
    data: { isCanonical: false },
  });
  console.log(`✔ Dividende manuel enregistré : ${ticker.toUpperCase()} ${year} = ${amount} FCFA/action (source=MANUEL, canonique)`);
}

async function correctRatio(ticker: string, year: number, flags: Record<string, string>) {
  const companyId = await getCompanyId(ticker);
  const per = flags.per !== undefined ? Number(flags.per) : undefined;
  const mktCap = flags.mktcap !== undefined ? Number(flags.mktcap) : undefined;
  if (per === undefined && mktCap === undefined) fail("Fournir au moins --per=X ou --mktcap=Y");

  await prisma.financialRatio.upsert({
    where: { uniq_ratio_company_year_source: { companyId, year, source: DataSource.MANUEL } },
    update: { ...(per !== undefined ? { per } : {}), ...(mktCap !== undefined ? { mktCap } : {}), isCanonical: true },
    create: { companyId, year, source: DataSource.MANUEL, per, mktCap, isCanonical: true },
  });
  await prisma.financialRatio.updateMany({
    where: { companyId, year, source: { not: DataSource.MANUEL } },
    data: { isCanonical: false },
  });
  console.log(`✔ Ratio manuel enregistré : ${ticker.toUpperCase()} ${year} (source=MANUEL, canonique)`);
}

async function main() {
  const [, , command, ...rest] = process.argv;
  if (!command) fail("Commande manquante. Usage : price | dividend | ratio <TICKER> ...");

  switch (command) {
    case "price": {
      const [ticker, date, closePriceStr, volumeStr] = rest;
      if (!ticker || !date || !closePriceStr) fail("Usage : price <TICKER> <YYYY-MM-DD> <closePrice> [volume]");
      await correctPrice(ticker, date, Number(closePriceStr), volumeStr ? Number(volumeStr) : null);
      break;
    }
    case "dividend": {
      const [ticker, yearStr, amountStr] = rest;
      if (!ticker || !yearStr || !amountStr) fail("Usage : dividend <TICKER> <year> <amount>");
      await correctDividend(ticker, Number(yearStr), Number(amountStr));
      break;
    }
    case "ratio": {
      const [ticker, yearStr, ...flagArgs] = rest;
      if (!ticker || !yearStr) fail("Usage : ratio <TICKER> <year> [--per=X] [--mktcap=Y]");
      await correctRatio(ticker, Number(yearStr), parseFlags(flagArgs));
      break;
    }
    default:
      fail(`Commande inconnue : "${command}". Attendu : price | dividend | ratio.`);
  }
}

main()
  .catch((err) => {
    console.error("❌ Erreur :", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
