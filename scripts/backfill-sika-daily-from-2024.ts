// Backfill journalier Sikafinance depuis 2024-01-01 (détail graphes).
// Usage : npx ts-node scripts/backfill-sika-daily-from-2024.ts [TICKER...]

import { DataSource } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sikafinanceConnector } from "../lib/ingestion/connectors/sikafinance_connector";
import { reconcilePriceBatch } from "../lib/ingestion/reconciliation";
import { persistPriceQuotes } from "../lib/ingestion/persist";
import type { RawPriceQuote } from "../lib/ingestion/types";

const DAILY_FROM = "2024-01-01";

async function main() {
  const only = process.argv.slice(2).map((t) => t.toUpperCase()).filter(Boolean);
  const companies = await prisma.company.findMany({
    where: { isActive: true, ...(only.length ? { ticker: { in: only } } : {}) },
    select: { id: true, ticker: true },
    orderBy: { ticker: "asc" },
  });
  const companyIdByTicker = new Map(companies.map((c) => [c.ticker, c.id]));

  console.log(
    `→ Backfill journalier Sika depuis ${DAILY_FROM} — ${companies.length} société(s)`
  );

  const allQuotes: RawPriceQuote[] = [];
  let ok = 0;
  let fail = 0;

  for (const co of companies) {
    const daily = await sikafinanceConnector.fetchDailyHistoryChunked(co.ticker, DAILY_FROM);
    if (!daily.ok) {
      fail++;
      console.warn(`▸ ${co.ticker}: ${daily.error}`);
      continue;
    }

    let added = 0;
    for (const q of daily.data) {
      const date = new Date(`${q.date}T00:00:00.000Z`);
      const hasBrvm = await prisma.priceHistory.findFirst({
        where: { companyId: co.id, date, source: DataSource.BRVM_OFFICIEL },
        select: { id: true },
      });
      if (hasBrvm) continue;

      const existing = await prisma.priceHistory.findFirst({
        where: { companyId: co.id, date, source: DataSource.SIKAFINANCE },
        select: { id: true, closePrice: true },
      });
      if (existing && Number(existing.closePrice) === q.closePrice) continue;

      allQuotes.push(q);
      added++;
    }
    ok++;
    console.log(`▸ ${co.ticker}: ${daily.data.length} pts Sika · +${added} à persister`);
  }

  if (allQuotes.length === 0) {
    console.log("✔ Aucun nouveau point");
    return;
  }

  const { reconciled } = reconcilePriceBatch(allQuotes);
  const filtered = [];
  for (const r of reconciled) {
    const companyId = companyIdByTicker.get(r.ticker);
    if (!companyId) continue;
    const date = new Date(`${r.date}T00:00:00.000Z`);
    const brvm = await prisma.priceHistory.findFirst({
      where: { companyId, date, source: DataSource.BRVM_OFFICIEL },
      select: { id: true },
    });
    if (brvm) continue;
    filtered.push(r);
  }

  const persist = await persistPriceQuotes(prisma, allQuotes, filtered, companyIdByTicker);
  console.log(
    `✔ upsert=${persist.upserted} canoniques=${persist.markedCanonical}` +
      ` · OK=${ok} échecs=${fail}`
  );
}

main()
  .catch((err) => {
    console.error("❌", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
