// Étape 4 bis — dette financière, flux d'exploitation, capex → staged/extras.csv (après validate.ts).
//   npx ts-node --transpile-only scripts/ngx/extras.ts [--tickers A,B]
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../../lib/ngx/fundamentals/csv";
import { NGX_COMPANIES } from "../../lib/ngx/fundamentals/companies";
import { buildExtrasRows, freeCashFlow, type ExtrasRow } from "../../lib/ngx/fundamentals/extras";
import type { ExtractedDoc } from "../../lib/ngx/fundamentals/validate";
import { readCsv } from "./csv-read";
import { EXTRACTED_DIR, STAGED_DIR, tickerFilter } from "./stage";

const only = tickerFilter();
const fund = readCsv<Record<string, string>>(path.join(STAGED_DIR, "fundamentals.csv"));
const rows: ExtrasRow[] = [];
for (const company of NGX_COMPANIES) {
  if (only && !only.includes(company.ticker)) continue;
  const f = path.join(EXTRACTED_DIR, `${company.ticker}.json`);
  if (!fs.existsSync(f)) continue;
  const { docs } = JSON.parse(fs.readFileSync(f, "utf8")) as { docs: ExtractedDoc[] };
  const chosen = new Map<number, string>();
  for (const r of fund) if (r.ticker === company.ticker && r.source_file) chosen.set(Number(r.fiscal_year), r.source_file);
  rows.push(...buildExtrasRows(company.ticker, docs, chosen));
}
const kindOf = new Map(NGX_COMPANIES.map((c) => [c.ticker, c.kind]));
const flat = rows.map((r) => {
  const fcf = freeCashFlow(r);
  return {
    ticker: r.ticker,
    kind: kindOf.get(r.ticker) ?? "",
    fiscal_year: r.fiscalYear,
    borrowings_bn: r.fields.borrowings?.valueBn ?? "",
    conf_borrowings: r.fields.borrowings?.confidence ?? "",
    cfo_bn: r.fields.operatingCashFlow?.valueBn ?? "",
    conf_cfo: r.fields.operatingCashFlow?.confidence ?? "",
    capex_bn: r.fields.capex?.valueBn ?? "",
    conf_capex: r.fields.capex?.confidence ?? "",
    fcf_bn: fcf?.valueBn ?? "",
    conf_fcf: fcf?.confidence ?? "",
    labels: [r.fields.borrowings?.label, r.fields.operatingCashFlow?.label, r.fields.capex?.label].filter(Boolean).join(" | "),
    source_pdf: r.sourcePdf,
  };
});
const COLS = ["ticker", "kind", "fiscal_year", "borrowings_bn", "conf_borrowings", "cfo_bn", "conf_cfo", "capex_bn", "conf_capex", "fcf_bn", "conf_fcf", "labels", "source_pdf"] as const;
fs.writeFileSync(path.join(STAGED_DIR, "extras.csv"), toCsv(flat, [...COLS]));
console.log(`[ngx-extras] ${flat.length} exercices → ${path.join(STAGED_DIR, "extras.csv")}`);
