// Étape 4 — validation : séries annuelles par société, recoupements, niveaux de confiance.
//   npx ts-node --transpile-only scripts/ngx/validate.ts [--tickers ...] [--from 2016] [--to 2025]
// Entrées : staged/extracted/*.json, staged/company_directory.json. Sorties dans staged/ :
//   fundamentals.csv, dividends.csv, review_queue.csv, coverage_summary.md / .csv / .json
import fs from "node:fs";
import path from "node:path";
import { toCsv, yearRanges } from "../../lib/ngx/fundamentals/csv";
import { NGX_COMPANIES } from "../../lib/ngx/fundamentals/companies";
import { ALL_FIELDS, CORE_FIELDS, buildStagedRows, type ExtractedDoc, type ReviewItem, type StagedRow } from "../../lib/ngx/fundamentals/validate";
import type { DividendNotice } from "../../lib/ngx/fundamentals/notices";
import { DIRECTORY_PATH, EXTRACTED_DIR, STAGED_DIR, arg, tickerFilter } from "./stage";

function main() {
  const from = Number(arg("from") ?? 2016);
  const to = Number(arg("to") ?? 2025);
  const only = tickerFilter();
  const directory: Array<{ Symbol: string; SharesOutstanding: number | null }> = JSON.parse(fs.readFileSync(DIRECTORY_PATH, "utf8"));
  const sharesOf = (t: string) => directory.find((d) => d.Symbol.trim().toUpperCase() === t)?.SharesOutstanding ?? null;

  const NOTICES = path.join(STAGED_DIR, "dividend_notices.json");
  const allNotices: DividendNotice[] = fs.existsSync(NOTICES) ? JSON.parse(fs.readFileSync(NOTICES, "utf8")) : [];
  if (!allNotices.length) console.warn("dividend_notices.json absent : DPS issu des seuls états audités");
  const allRows: StagedRow[] = [];
  const allReview: ReviewItem[] = [];
  for (const company of NGX_COMPANIES) {
    if (only && !only.includes(company.ticker)) continue;
    const f = path.join(EXTRACTED_DIR, `${company.ticker}.json`);
    if (!fs.existsSync(f)) {
      console.warn(`pas d'extraction pour ${company.ticker}`);
      continue;
    }
    const { docs } = JSON.parse(fs.readFileSync(f, "utf8")) as { docs: ExtractedDoc[] };
    const { rows, review } = buildStagedRows(company, docs, { fromYear: from, toYear: to, shares: sharesOf(company.ticker), notices: allNotices.filter((n) => n.ticker === company.ticker) });
    allRows.push(...rows);
    allReview.push(...review);
  }

  // fundamentals.csv
  const flat = allRows.map((r) => ({
    ticker: r.ticker,
    fiscal_year: r.fiscalYear,
    currency: r.currency,
    unit: r.unit,
    revenue_bn: r.revenueBn,
    revenue_basis: r.revenueBasis,
    operating_profit_bn: r.operatingProfitBn,
    operating_basis: r.operatingBasis,
    net_profit_bn: r.netProfitBn,
    net_profit_basis: r.netProfitBasis,
    net_profit_total_bn: r.netProfitTotalBn,
    equity_bn: r.equityBn,
    equity_basis: r.equityBasis,
    eps: r.eps,
    dps: r.dps,
    dps_source: r.dpsKind,
    dps_notice: r.dpsNotice,
    shares_outstanding_ngx: r.sharesOutstanding,
    implied_shares: r.impliedShares,
    conf_revenue: r.conf.revenue,
    conf_operating_profit: r.conf.operatingProfit,
    conf_net_profit: r.conf.netProfit,
    conf_equity: r.conf.equity,
    conf_eps: r.conf.eps,
    conf_dps: r.conf.dps,
    restated_in_next_year: Object.entries(r.restated).map(([k, v]) => `${k}=${v}`).join(";"),
    restated_pct: Object.entries(r.restatedPct).map(([k, v]) => `${k}=${v}%`).join(";"),
    source_pdf: r.sourceUrl,
    source_file: r.sourceFile,
    pages: r.pages,
    notes: r.notes.join("; "),
  }));
  fs.mkdirSync(STAGED_DIR, { recursive: true });
  fs.writeFileSync(path.join(STAGED_DIR, "fundamentals.csv"), toCsv(flat, Object.keys(flat[0] ?? {}) as never));

  // dividends.csv
  const divRows = allRows
    .filter((r) => r.dps !== null)
    .map((r) => ({ ticker: r.ticker, fiscal_year: r.fiscalYear, dps: r.dps, currency: r.currency ?? "NGN", confidence: r.conf.dps, source: r.dpsKind, origin: r.dpsSource, ngx_notice: r.dpsNotice, ngx_notice_files: r.dpsNoticeFiles, cashflow_gap: r.dpsCashGap ?? "", source_pdf: r.sourceUrl, restated_in_next_year: r.restated.dps ?? "" }));
  fs.writeFileSync(path.join(STAGED_DIR, "dividends.csv"), toCsv(divRows, ["ticker", "fiscal_year", "dps", "currency", "confidence", "source", "origin", "ngx_notice", "ngx_notice_files", "cashflow_gap", "source_pdf", "restated_in_next_year"]));

  // review_queue.csv
  const order = { low: 0, medium: 1, info: 2 } as const;
  const rq = allReview
    .slice()
    .sort((a, b) => order[a.severity] - order[b.severity] || a.ticker.localeCompare(b.ticker) || (a.fiscalYear ?? 0) - (b.fiscalYear ?? 0));
  fs.writeFileSync(
    path.join(STAGED_DIR, "review_queue.csv"),
    toCsv(rq.map((x) => ({ ...x, page: x.page ?? "" })), ["ticker", "fiscalYear", "field", "severity", "reason", "value", "sourceFile", "page"]),
  );

  // couverture
  const coverage: Array<Record<string, string | number>> = [];
  const label: Record<string, string> = { revenue: "revenue", operatingProfit: "op_profit", netProfit: "net_profit", equity: "equity", eps: "eps", dps: "dps" };
  let confidentYears = 0;
  let usableYears = 0;
  const usableTotals: Record<string, number> = {};
  let totalYears = 0;
  const fieldTotals: Record<string, number> = {};
  for (const company of NGX_COMPANIES) {
    if (only && !only.includes(company.ticker)) continue;
    const rs = allRows.filter((r) => r.ticker === company.ticker);
    if (!rs.length) continue;
    const entry: Record<string, string | number> = { ticker: company.ticker };
    for (const k of ALL_FIELDS) {
      const ys = rs.filter((r) => r.conf[k] === "high").map((r) => r.fiscalYear);
      entry[label[k]] = yearRanges(ys) || "-";
      entry[`${label[k]}_n`] = ys.length;
      fieldTotals[k] = (fieldTotals[k] ?? 0) + ys.length;
    }
    const full = rs.filter((r) => CORE_FIELDS.every((k) => r.conf[k] === "high"));
    entry.all5_n = full.length;
    entry.all5_years = yearRanges(full.map((r) => r.fiscalYear)) || "-";
    confidentYears += full.length;
    usableYears += rs.filter((r) => CORE_FIELDS.every((k) => r.conf[k] === "high" || r.conf[k] === "medium")).length;
    for (const k of ALL_FIELDS) usableTotals[k] = (usableTotals[k] ?? 0) + rs.filter((r) => r.conf[k] === "high" || r.conf[k] === "medium").length;
    totalYears += rs.length;
    coverage.push(entry);
  }
  const cols = ["ticker", ...ALL_FIELDS.map((k) => label[k]), "all5_n", "all5_years"];
  fs.writeFileSync(path.join(STAGED_DIR, "coverage_summary.csv"), toCsv(coverage, cols as never));
  const pct = (n: number) => `${((100 * n) / Math.max(totalYears, 1)).toFixed(0)}%`;
  const md = [
    `# NGX fundamentals — coverage of HIGH-confidence values (${from}-${to})`,
    "",
    `Company-years with all of revenue, operating profit, net profit, equity and EPS at high confidence: **${confidentYears}/${totalYears} (${pct(confidentYears)})**`,
    "",
    "Per field (high confidence): " + ALL_FIELDS.map((k) => `${label[k]} ${fieldTotals[k] ?? 0}/${totalYears} (${pct(fieldTotals[k] ?? 0)})`).join(", "),
    "",
    `Usable (high or medium) for all five core fields: **${usableYears}/${totalYears} (${pct(usableYears)})** — per field: ` + ALL_FIELDS.map((k) => `${label[k]} ${pct(usableTotals[k] ?? 0)}`).join(", "),
    "",
    "Medium = value read once with no independent confirmation (latest year with no comparative, value taken only from the next AFS comparative column) or contradicted by the next AFS (restated >1%; the original is kept and the restated value is in restated_in_next_year). DPS is only present when a dividend was found in the AFS (non-payers and unreadable years are blank).",
    "",
    "| Ticker | Revenue | Op. profit | Net profit | Equity | EPS | DPS | all 5 |",
    "|---|---|---|---|---|---|---|---|",
    ...coverage.map((c) => `| ${c.ticker} | ${c.revenue} | ${c.op_profit} | ${c.net_profit} | ${c.equity} | ${c.eps} | ${c.dps} | ${c.all5_n}/${to - from + 1} |`),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(STAGED_DIR, "coverage_summary.md"), md);
  fs.writeFileSync(path.join(STAGED_DIR, "coverage_summary.json"), JSON.stringify({ from, to, confidentYears, usableYears, totalYears, fieldTotals, usableTotals, coverage }, null, 1));
  console.log(md);
  console.log(`review_queue: ${rq.length} lignes (${rq.filter((x) => x.severity === "low").length} low)`);
}

main();
