// Complète les PER manquants ou nuls via Sikafinance (fallback après BRVM).
import { prisma } from "../lib/prisma";
import { sikafinanceConnector } from "../lib/ingestion/connectors/sikafinance_connector";
import { persistFinancialRatios } from "../lib/ingestion/persist";
import type { RawCompanyFundamentals } from "../lib/ingestion/types";

const TICKERS = process.argv.slice(2).map((t) => t.toUpperCase());
const CURRENT_YEAR = new Date().getUTCFullYear();

function validPer(per: number | null | undefined): per is number {
  return per != null && Number.isFinite(per) && per > 0;
}

async function main() {
  // Nettoie les PER BRVM à 0 (non publié / non calculable) pour laisser place au fallback.
  await prisma.financialRatio.updateMany({
    where: { per: 0 },
    data: { per: null },
  });

  let targets: Array<{ id: string; ticker: string }>;

  if (TICKERS.length) {
    targets = await prisma.company.findMany({
      where: { isActive: true, ticker: { in: TICKERS } },
      select: { id: true, ticker: true },
      orderBy: { ticker: "asc" },
    });
  } else {
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, ticker: true },
      orderBy: { ticker: "asc" },
    });
    const ratios = await prisma.financialRatio.findMany({
      where: { isCanonical: true },
      select: { companyId: true, year: true, per: true },
      orderBy: [{ companyId: "asc" }, { year: "desc" }],
    });
    const bestPer = new Map<string, number | null>();
    for (const r of ratios) {
      const per = r.per != null ? Number(r.per) : null;
      if (!bestPer.has(r.companyId)) bestPer.set(r.companyId, validPer(per) ? per : null);
      else if (!validPer(bestPer.get(r.companyId)) && validPer(per)) bestPer.set(r.companyId, per);
    }
    targets = companies.filter((c) => !validPer(bestPer.get(c.id) ?? null));
  }

  const brvmRows = await prisma.financialRatio.findMany({
    where: {
      companyId: { in: targets.map((t) => t.id) },
      source: "BRVM_OFFICIEL",
      year: CURRENT_YEAR,
    },
    select: { companyId: true },
  });
  const hasBrvmYear = new Set(brvmRows.map((r) => r.companyId));
  targets = targets.filter((c) => !hasBrvmYear.has(c.id));

  if (targets.length === 0) {
    console.log("✔ Aucun PER à compléter.");
    return;
  }

  console.log(`→ Sikafinance PER pour ${targets.length} société(s) : ${targets.map((t) => t.ticker).join(", ")}`);
  const companyIdByTicker = new Map(targets.map((c) => [c.ticker, c.id]));
  const fundamentals: RawCompanyFundamentals[] = [];

  for (const { ticker } of targets) {
    const sheet = await sikafinanceConnector.fetchCompanySheet(ticker);
    if (!sheet.ok) {
      console.warn(`  ${ticker}: échec — ${sheet.error}`);
      continue;
    }
    const latest = [...sheet.data.fundamentals]
      .filter((f) => validPer(f.per))
      .sort((a, b) => b.year - a.year)[0];
    if (!latest || !validPer(latest.per)) {
      console.warn(`  ${ticker}: aucun PER > 0 sur Sikafinance`);
      continue;
    }
    console.log(`  ${ticker}: PER=${latest.per} (Sika ${latest.year} → canon ${CURRENT_YEAR})`);
    fundamentals.push({
      ...latest,
      year: CURRENT_YEAR,
      mktCapMds: latest.mktCapMds,
    });
  }

  if (fundamentals.length === 0) {
    console.log("⚠ Aucun PER récupéré.");
    return;
  }

  const persisted = await persistFinancialRatios(prisma, fundamentals, companyIdByTicker);
  console.log(`✔ ${persisted.upserted} ratio(s) upserté(s), ${persisted.markedCanonical} canonique(s)`);
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
