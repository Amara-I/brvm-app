// Croise PER en base vs BRVM.org vs Sikafinance pour une liste de tickers.
import { prisma } from "../lib/prisma";
import { brvmConnector } from "../lib/ingestion/connectors/brvm_connector";
import { sikafinanceConnector } from "../lib/ingestion/connectors/sikafinance_connector";

const TICKERS = (
  process.argv.slice(2).length
    ? process.argv.slice(2)
    : ["UNLC", "BNBC", "BOAN", "SICC", "SDSC", "SIVC", "SAFC", "FTSC", "CFAC"]
).map((t) => t.toUpperCase());

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "N/D";
  return n.toFixed(2);
}

async function main() {
  const companies = await prisma.company.findMany({
    where: { ticker: { in: TICKERS } },
    select: { id: true, ticker: true, name: true },
    orderBy: { ticker: "asc" },
  });

  const ratios = await prisma.financialRatio.findMany({
    where: { companyId: { in: companies.map((c) => c.id) }, isCanonical: true },
    orderBy: [{ year: "desc" }],
  });
  const dbByTicker = new Map<string, { per: number | null; source: string; year: number }>();
  for (const c of companies) {
    const rows = ratios.filter((r) => r.companyId === c.id).sort((a, b) => b.year - a.year);
    const best = rows.find((r) => r.per != null && Number(r.per) > 0) ?? rows[0];
    if (best) {
      dbByTicker.set(c.ticker, {
        per: best.per != null ? Number(best.per) : null,
        source: best.source,
        year: best.year,
      });
    }
  }

  console.log("Ticker\tBase\tSource\tBRVM\tSika(latest)\tÉcart BRVM%\tÉcart Sika%");
  console.log("─".repeat(90));

  const brvm = await brvmConnector.fetchFundamentals(TICKERS);
  const brvmMap = new Map(brvm.data.map((r) => [r.ticker, r.per]));

  for (const c of companies) {
    const db = dbByTicker.get(c.ticker);
    let sikaPer: number | null = null;
    const sheet = await sikafinanceConnector.fetchCompanySheet(c.ticker);
    if (sheet.ok) {
      const latest = [...sheet.data.fundamentals]
        .filter((f) => f.per != null && f.per > 0)
        .sort((a, b) => b.year - a.year)[0];
      sikaPer = latest?.per ?? null;
    }
    const brvmPer = brvmMap.get(c.ticker) ?? null;
    const basePer = db?.per ?? null;
    const deltaBrvm =
      basePer != null && brvmPer != null && brvmPer > 0
        ? `${(((basePer - brvmPer) / brvmPer) * 100).toFixed(1)}%`
        : "—";
    const deltaSika =
      basePer != null && sikaPer != null && sikaPer > 0
        ? `${(((basePer - sikaPer) / sikaPer) * 100).toFixed(1)}%`
        : "—";
    console.log(
      `${c.ticker}\t${fmt(basePer)}\t${db?.source ?? "?"}\t${fmt(brvmPer)}\t${fmt(sikaPer)}\t${deltaBrvm}\t${deltaSika}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
