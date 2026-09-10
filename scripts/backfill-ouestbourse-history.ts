// Backfill historique journalier depuis ouestbourse.com (Supabase public).
// Usage :
//   npx ts-node scripts/backfill-ouestbourse-history.ts
//   npx ts-node scripts/backfill-ouestbourse-history.ts SNTS ABJC
//
// Ne remplace jamais BRVM_OFFICIEL ni SIKAFINANCE déjà canoniques.
// Comble les trous (ex. avant 2024) avec source OUESTBOURSE.

import { DataSource } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  fetchOuestboursePriceHistory,
  fetchOuestbourseSymbols,
  isOuestbourseSupabaseConfigured,
  obBarsToQuotes,
} from "../lib/ingestion/connectors/ouestbourse_supabase";

const KEEP_CANONICAL = new Set<DataSource>([
  DataSource.BRVM_OFFICIEL,
  DataSource.SIKAFINANCE,
]);

async function main() {
  if (!isOuestbourseSupabaseConfigured()) {
    console.error("❌ Définir OUESTBOURSE_SUPABASE_ANON_KEY dans .env");
    process.exit(1);
  }

  const only = process.argv.slice(2).map((t) => t.toUpperCase()).filter(Boolean);
  const remoteSymbols = only.length ? only : await fetchOuestbourseSymbols();
  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      ...(only.length ? { ticker: { in: only } } : { ticker: { in: remoteSymbols } }),
    },
    select: { id: true, ticker: true },
    orderBy: { ticker: "asc" },
  });

  console.log(`→ Backfill OuestBourse.com — ${companies.length} société(s)`);

  let upserted = 0;
  let marked = 0;
  let ok = 0;
  let fail = 0;

  for (const co of companies) {
    try {
      const bars = await fetchOuestboursePriceHistory(co.ticker);
      if (bars.length === 0) {
        console.warn(`▸ ${co.ticker}: 0 barre`);
        fail++;
        continue;
      }
      const quotes = obBarsToQuotes(co.ticker, bars);
      let added = 0;
      let canoned = 0;

      for (const q of quotes) {
        const date = new Date(`${q.date}T00:00:00.000Z`);
        await prisma.priceHistory.upsert({
          where: {
            uniq_price_company_date_source: {
              companyId: co.id,
              date,
              source: DataSource.OUESTBOURSE,
            },
          },
          update: {
            closePrice: q.closePrice,
            volume: q.volume != null ? BigInt(Math.round(q.volume)) : null,
            ingestedAt: new Date(),
          },
          create: {
            companyId: co.id,
            date,
            source: DataSource.OUESTBOURSE,
            closePrice: q.closePrice,
            volume: q.volume != null ? BigInt(Math.round(q.volume)) : null,
          },
        });
        added++;

        const dayStart = date;
        const dayEnd = new Date(date);
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
        const protectedCanon = await prisma.priceHistory.findFirst({
          where: {
            companyId: co.id,
            date: { gte: dayStart, lt: dayEnd },
            isCanonical: true,
            source: { in: [...KEEP_CANONICAL] },
          },
          select: { id: true },
        });
        if (protectedCanon) continue;

        await prisma.priceHistory.updateMany({
          where: { companyId: co.id, date: { gte: dayStart, lt: dayEnd } },
          data: { isCanonical: false },
        });
        await prisma.priceHistory.update({
          where: {
            uniq_price_company_date_source: {
              companyId: co.id,
              date,
              source: DataSource.OUESTBOURSE,
            },
          },
          data: { isCanonical: true },
        });
        canoned++;
      }

      upserted += added;
      marked += canoned;
      ok++;
      console.log(`▸ ${co.ticker}: ${bars.length} barres · upsert ${added} · canon +${canoned}`);
    } catch (err) {
      fail++;
      console.warn(`▸ ${co.ticker}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`✔ upsert=${upserted} canoniques=${marked} · OK=${ok} échecs=${fail}`);
}

main()
  .catch((err) => {
    console.error("❌", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
