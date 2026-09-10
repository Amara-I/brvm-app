// ═══════════════════════════════════════════════════════════════════════════
// Enrichissement multi-onglets Sikafinance (HISTORIQUES + SOCIETE)
// ═══════════════════════════════════════════════════════════════════════════
// Pour chaque société active :
//   1) Historique annuel (GetHistos xperiod=365) — années manquantes
//   2) Historique mensuel (xperiod=30) — densification
//   3) Historique journalier chunké (~89 j) sur N années — graphes
//   4) Page SOCIETE — ISIN, description, PER/croissance/dividendes/cap
//
// Ne remplace jamais un cours / dividende BRVM_OFFICIEL déjà présent.
//
// Usage :
//   npm run enrich:sikafinance
//   npx ts-node scripts/enrich-from-sikafinance.ts SNTS ABJC
//   npx ts-node scripts/enrich-from-sikafinance.ts --daily-years=3
//   npx ts-node scripts/enrich-from-sikafinance.ts --daily-from=2024-01-01
// ═══════════════════════════════════════════════════════════════════════════

import { DataSource } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sikafinanceConnector } from "../lib/ingestion/connectors/sikafinance_connector";
import { reconcilePriceBatch } from "../lib/ingestion/reconciliation";
import {
  persistCompanyProfiles,
  persistDividendRows,
  persistFinancialRatios,
  persistPriceQuotes,
} from "../lib/ingestion/persist";
import { toIsoDate } from "../lib/ingestion/parse-utils";
import type { RawPriceQuote } from "../lib/ingestion/types";

function parseDailyYears(argv: string[]): number {
  const flag = argv.find((a) => a.startsWith("--daily-years="));
  // 3 ans : couvre tout 2024+ (le défaut 2 s'arrêtait ~août 2024 → trou mensuel).
  if (!flag) return 3;
  const n = Number(flag.split("=")[1]);
  return Number.isFinite(n) && n >= 0 && n <= 15 ? Math.floor(n) : 3;
}

/** Ex. --daily-from=2024-01-01 (prioritaire sur --daily-years). */
function parseDailyFrom(argv: string[], dailyYears: number): string | null {
  const flag = argv.find((a) => a.startsWith("--daily-from="));
  if (flag) {
    const iso = flag.split("=")[1]?.trim() ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  }
  if (dailyYears <= 0) return null;
  const from = new Date();
  from.setUTCFullYear(from.getUTCFullYear() - dailyYears);
  return toIsoDate(from);
}

async function collectMissingQuotes(
  companyId: string,
  quotes: RawPriceQuote[]
): Promise<RawPriceQuote[]> {
  const out: RawPriceQuote[] = [];
  for (const q of quotes) {
    const date = new Date(`${q.date}T00:00:00.000Z`);
    const hasBrvm = await prisma.priceHistory.findFirst({
      where: { companyId, date, source: DataSource.BRVM_OFFICIEL },
      select: { id: true },
    });
    if (hasBrvm) continue;

    const existing = await prisma.priceHistory.findFirst({
      where: { companyId, date, source: DataSource.SIKAFINANCE },
      select: { id: true, closePrice: true },
    });
    if (existing && Number(existing.closePrice) === q.closePrice) continue;

    out.push(q);
  }
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const dailyYears = parseDailyYears(argv);
  const dailyFrom = parseDailyFrom(argv, dailyYears);
  const only = argv.filter((a) => !a.startsWith("--")).map((t) => t.toUpperCase());

  const companies = await prisma.company.findMany({
    where: { isActive: true, ...(only.length ? { ticker: { in: only } } : {}) },
    select: { id: true, ticker: true },
    orderBy: { ticker: "asc" },
  });
  const companyIdByTicker = new Map(companies.map((c) => [c.ticker, c.id]));

  console.log(
    `→ Enrichissement Sikafinance — ${companies.length} société(s)` +
      (dailyFrom
        ? ` · quotidien depuis ${dailyFrom}`
        : ` · quotidien=désactivé`)
  );

  let ok = 0;
  let fail = 0;
  const allPriceQuotes: RawPriceQuote[] = [];

  for (const co of companies) {
    console.log(`\n▸ ${co.ticker}`);
    let tickerOk = true;

    // 1) Annuel
    const annual = await sikafinanceConnector.fetchAnnualHistory(co.ticker, 1998);
    if (annual.ok) {
      const missing = await collectMissingQuotes(co.id, annual.data);
      allPriceQuotes.push(...missing);
      console.log(`  annuel: ${annual.data.length} pts · +${missing.length}`);
    } else {
      tickerOk = false;
      console.warn(`  annuel: ${annual.error}`);
    }

    // 2) Mensuel
    const monthly = await sikafinanceConnector.fetchMonthlyHistory(co.ticker, 2015);
    if (monthly.ok) {
      const missing = await collectMissingQuotes(co.id, monthly.data);
      allPriceQuotes.push(...missing);
      console.log(`  mensuel: ${monthly.data.length} pts · +${missing.length}`);
    } else {
      console.warn(`  mensuel: ${monthly.error}`);
    }

    // 3) Journalier chunké (détail graphes 2024+)
    if (dailyFrom) {
      const daily = await sikafinanceConnector.fetchDailyHistoryChunked(co.ticker, dailyFrom);
      if (daily.ok) {
        const missing = await collectMissingQuotes(co.id, daily.data);
        allPriceQuotes.push(...missing);
        console.log(`  journalier: ${daily.data.length} pts · +${missing.length}`);
      } else {
        console.warn(`  journalier: ${daily.error}`);
      }
    }

    // 4) SOCIETE
    const sheet = await sikafinanceConnector.fetchCompanySheet(co.ticker);
    if (sheet.ok) {
      const { profile, fundamentals, dividends } = sheet.data;
      const prof = await persistCompanyProfiles(prisma, [profile], companyIdByTicker);
      const ratios = await persistFinancialRatios(prisma, fundamentals, companyIdByTicker);
      const divs = await persistDividendRows(prisma, dividends, companyIdByTicker);
      console.log(
        `  société: ISIN=${profile.isin ?? "N/D"}` +
          ` · ratios +${ratios.upserted}` +
          ` · div +${divs.upserted}` +
          ` · profil +${prof.updated}`
      );
    } else {
      tickerOk = false;
      console.warn(`  société: ${sheet.error}`);
    }

    if (tickerOk) ok++;
    else fail++;
  }

  if (allPriceQuotes.length > 0) {
    const { reconciled } = reconcilePriceBatch(allPriceQuotes);
    // Ne marque canonique que s'il n'existe pas déjà une ligne BRVM à la date.
    const filteredReconciled = [];
    for (const r of reconciled) {
      const companyId = companyIdByTicker.get(r.ticker);
      if (!companyId) continue;
      const date = new Date(`${r.date}T00:00:00.000Z`);
      const brvm = await prisma.priceHistory.findFirst({
        where: { companyId, date, source: DataSource.BRVM_OFFICIEL },
        select: { id: true },
      });
      if (brvm) continue;
      filteredReconciled.push(r);
    }
    const persist = await persistPriceQuotes(
      prisma,
      allPriceQuotes,
      filteredReconciled,
      companyIdByTicker
    );
    console.log(
      `\n✔ prix upsert=${persist.upserted} canoniques=${persist.markedCanonical}` +
        ` · tickers OK=${ok} échecs partiels=${fail}`
    );
  } else {
    console.log(`\n✔ Aucun nouveau point de cours · tickers OK=${ok} échecs partiels=${fail}`);
  }
}

main()
  .catch((err) => {
    console.error("❌", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
