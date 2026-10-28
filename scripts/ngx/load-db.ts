// Étape 5 — chargement en base des fondamentaux NGX validés (INSERT uniquement, jamais d'écrasement).
//
//   npx ts-node --transpile-only scripts/ngx/load-db.ts --offline            # plan depuis les CSV, sans base
//   npx ts-node --transpile-only scripts/ngx/load-db.ts                       # --dry-run (défaut) : lit la base, n'écrit rien
//   NGX_LOAD_CONFIRM=yes npx ts-node --transpile-only scripts/ngx/load-db.ts --apply [--min=high|medium]
//
// Sécurités : le mode par défaut est --dry-run ; --apply exige en plus NGX_LOAD_CONFIRM=yes ;
// aucune ligne existante n'est modifiée (financial_ratios / dividends / company_documents :
// créées seulement si absentes ; profile_meta.ngxFundamentals.years.<année> : fusionné sans écraser une valeur présente).
// Cibles : financial_ratios (₦ bn) · dividends (₦/action, source NGX_OFFICIEL) · company_documents · companies.profile_meta.
import path from "node:path";
import { buildLoadPlan, type DividendCsvRow, type FundamentalsCsvRow } from "../../lib/ngx/fundamentals/load-plan";
import type { Confidence } from "../../lib/ngx/fundamentals/types";
import { readCsv } from "./csv-read";
import { STAGED_DIR, arg, flag } from "./stage";

async function main() {
  const apply = flag("apply");
  const offline = flag("offline");
  const min = (arg("min") ?? "high") as Confidence;
  if (apply && process.env.NGX_LOAD_CONFIRM !== "yes") {
    console.error("--apply exige NGX_LOAD_CONFIRM=yes. Rien n'est écrit.");
    process.exit(2);
  }
  const fund = readCsv<FundamentalsCsvRow>(path.join(STAGED_DIR, "fundamentals.csv"));
  const divs = readCsv<DividendCsvRow>(path.join(STAGED_DIR, "dividends.csv"));
  const plan = buildLoadPlan(fund, divs, min);
  console.log(`[ngx-load] mode=${apply ? "APPLY" : "DRY-RUN"}${offline ? " (offline)" : ""} min=${min}`);
  console.log(`[ngx-load] plan : ${plan.ratios.length} financial_ratios, ${plan.meta.length} profile_meta, ${plan.dividends.length} dividends, ${plan.documents.length} company_documents, ${plan.skipped.length} ignorés`);
  for (const s of plan.skipped.slice(0, 20)) console.log(`  skip ${s.ticker} ${s.year}: ${s.reason}`);
  if (offline) return;

  const { prisma } = await import("../../lib/prisma");
  try {
    const tickers = [...new Set([...plan.ratios, ...plan.meta, ...plan.dividends, ...plan.documents].map((p) => p.ticker))];
    const companies = await prisma.company.findMany({ where: { ticker: { in: tickers }, exchange: "NGX" }, select: { id: true, ticker: true, profileMeta: true } });
    const byTicker = new Map(companies.map((c) => [c.ticker, c]));
    const missing = tickers.filter((t) => !byTicker.has(t));
    if (missing.length) console.warn(`[ngx-load] sociétés absentes de la base (ignorées) : ${missing.join(", ")}`);
    const stats = { ratiosNew: 0, ratiosExisting: 0, divNew: 0, divExisting: 0, docNew: 0, docExisting: 0, metaUpdated: 0 };
    const verb = apply ? "écrit" : "à écrire";

    for (const r of plan.ratios) {
      const c = byTicker.get(r.ticker);
      if (!c) continue;
      const where = { companyId_year_source: { companyId: c.id, year: r.year, source: "NGX_OFFICIEL" as const } };
      const existing = await prisma.financialRatio.findUnique({ where }).catch(() => null);
      if (existing) { stats.ratiosExisting++; continue; }
      stats.ratiosNew++;
      if (apply) await prisma.financialRatio.create({ data: { companyId: c.id, year: r.year, source: "NGX_OFFICIEL", isCanonical: true, revenue: r.revenue, operatingIncome: r.operatingIncome, netIncome: r.netIncome } });
    }
    for (const d of plan.dividends) {
      const c = byTicker.get(d.ticker);
      if (!c) continue;
      const existing = await prisma.dividend.findFirst({ where: { companyId: c.id, year: d.year, source: "NGX_OFFICIEL" } });
      if (existing) { stats.divExisting++; continue; }
      stats.divNew++;
      if (apply) await prisma.dividend.create({ data: { companyId: c.id, year: d.year, amount: d.amount, source: "NGX_OFFICIEL", isCanonical: true } });
    }
    for (const d of plan.documents) {
      const c = byTicker.get(d.ticker);
      if (!c) continue;
      const existing = await prisma.companyDocument.findFirst({ where: { companyId: c.id, url: d.url } });
      if (existing) { stats.docExisting++; continue; }
      stats.docNew++;
      if (apply) await prisma.companyDocument.create({ data: { companyId: c.id, url: d.url, filename: d.filename, title: `Audited financial statements FY${d.year}`, docType: "AUDITED_FS", periodLabel: `FY${d.year}`, sourceName: "NGX" } });
    }
    // profile_meta.ngxFundamentals.years.<année> : fusion sans écraser les valeurs déjà présentes
    const metaByTicker = new Map<string, typeof plan.meta>();
    for (const m of plan.meta) metaByTicker.set(m.ticker, [...(metaByTicker.get(m.ticker) ?? []), m]);
    for (const [ticker, list] of metaByTicker) {
      const c = byTicker.get(ticker);
      if (!c) continue;
      const root = (c.profileMeta && typeof c.profileMeta === "object" && !Array.isArray(c.profileMeta) ? { ...(c.profileMeta as Record<string, unknown>) } : {}) as Record<string, unknown>;
      const nf = { ...((root.ngxFundamentals as Record<string, unknown>) ?? {}) } as Record<string, unknown>;
      const years = { ...((nf.years as Record<string, Record<string, unknown>>) ?? {}) };
      let changed = false;
      for (const m of list) {
        const cur = { ...(years[String(m.year)] ?? {}) };
        if (cur.equityBn == null && m.equityBn !== null) { cur.equityBn = m.equityBn; changed = true; }
        if (cur.epsNgn == null && m.epsNgn !== null) { cur.epsNgn = m.epsNgn; changed = true; }
        if (!cur.sourceUrl && m.sourceUrl) cur.sourceUrl = m.sourceUrl;
        years[String(m.year)] = cur;
      }
      if (!changed) continue;
      stats.metaUpdated++;
      if (apply) await prisma.company.update({ where: { id: c.id }, data: { profileMeta: { ...root, ngxFundamentals: { ...nf, years } } as never } });
    }
    console.log(`[ngx-load] ${verb} : ratios +${stats.ratiosNew} (déjà là ${stats.ratiosExisting}), dividendes +${stats.divNew} (déjà là ${stats.divExisting}), documents +${stats.docNew} (déjà là ${stats.docExisting}), profile_meta ${stats.metaUpdated} sociétés`);
    if (!apply) console.log("[ngx-load] DRY-RUN : aucune écriture. Relancer avec --apply et NGX_LOAD_CONFIRM=yes après revue.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
