// Étape 5 (variante SQL) — écrit, depuis les CSV validés, un script SQL par société + preview.sql + rollback.sql
// dans staged/sql/ (hors dépôt). Aucune connexion base. À appliquer ensuite via l'outil SQL de Supabase.
//   npx ts-node --transpile-only scripts/ngx/emit-sql.ts [--min high|medium] [--tickers A,B]
import fs from "node:fs";
import path from "node:path";
import { buildLoadPlan, type DividendCsvRow, type FundamentalsCsvRow } from "../../lib/ngx/fundamentals/load-plan";
import { buildCompanySql, buildPreviewSql, buildRollbackSql, plannedTickers } from "../../lib/ngx/fundamentals/load-sql";
import type { Confidence } from "../../lib/ngx/fundamentals/types";
import { readCsv } from "./csv-read";
import { STAGED_DIR, arg, tickerFilter } from "./stage";

const min = (arg("min") ?? "high") as Confidence;
const plan = buildLoadPlan(
  readCsv<FundamentalsCsvRow>(path.join(STAGED_DIR, "fundamentals.csv")),
  readCsv<DividendCsvRow>(path.join(STAGED_DIR, "dividends.csv")),
  min,
);
const all = plannedTickers(plan);
const only = tickerFilter();
const tickers = only ? all.filter((t) => only.includes(t)) : all;
const dir = path.join(STAGED_DIR, "sql");
fs.mkdirSync(dir, { recursive: true });
const totals = { ratios: 0, meta: 0, dividends: 0, documents: 0 };
const manifest: Array<{ ticker: string; file: string; bytes: number } & Record<string, number | string>> = [];
for (const t of tickers) {
  const { sql, counts } = buildCompanySql(plan, t);
  const file = `${t}.sql`;
  fs.writeFileSync(path.join(dir, file), sql);
  for (const k of Object.keys(totals) as Array<keyof typeof totals>) totals[k] += counts[k];
  manifest.push({ ticker: t, file, bytes: Buffer.byteLength(sql), ...counts });
}
fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ min, totals, companies: manifest }, null, 1));
fs.writeFileSync(path.join(dir, "preview.sql"), buildPreviewSql(all));
fs.writeFileSync(path.join(STAGED_DIR, "rollback.sql"), buildRollbackSql(all));
console.log(`[ngx-sql] ${tickers.length} sociétés → ${dir} ; totaux ${JSON.stringify(totals)} ; rollback.sql écrit (${all.length} sociétés)`);
