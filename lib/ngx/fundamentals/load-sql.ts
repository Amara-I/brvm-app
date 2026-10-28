// Étape 5 (variante SQL) — génère du SQL idempotent à partir du plan de chargement, pour les
// environnements sans accès direct à Postgres (exécution via l'outil SQL de Supabase).
// Pur : aucune lecture de fichier ni de base. Mêmes règles que scripts/ngx/load-db.ts :
//  - insertion seulement (ON CONFLICT DO NOTHING / NOT EXISTS), jamais d'écrasement ;
//  - seulement les sociétés NGX (exchange = 'NGX') ;
//  - financial_ratios / dividends : source NGX_OFFICIEL, is_canonical = true (₦ bn / ₦ par action) ;
//  - profile_meta.ngxFundamentals.years fusionné par `||` : une année déjà présente est conservée.
import type { LoadPlan } from "./load-plan";

export const NGX_SOURCE = "NGX_OFFICIEL";
export const ID_PREFIX = { ratio: "ngx-fr-", dividend: "ngx-dv-", document: "ngx-doc-" } as const;

export const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const n = (v: number | null, digits: number) => (v === null || !Number.isFinite(v) ? "NULL" : String(Number(v.toFixed(digits))));
const tickerSql = (t: string) => {
  if (!/^[A-Z0-9.\-&]+$/.test(t)) throw new Error(`ticker invalide : ${t}`);
  return q(t);
};

export interface CompanySql {
  ticker: string;
  counts: { ratios: number; meta: number; dividends: number; documents: number };
  sql: string;
}

/** Un script transactionnel par société. */
export function buildCompanySql(plan: LoadPlan, ticker: string): CompanySql {
  const ratios = plan.ratios.filter((r) => r.ticker === ticker);
  const meta = plan.meta.filter((r) => r.ticker === ticker);
  const dividends = plan.dividends.filter((r) => r.ticker === ticker);
  const documents = plan.documents.filter((r) => r.ticker === ticker);
  const t = tickerSql(ticker);
  const co = `(SELECT id FROM companies WHERE ticker = ${t} AND exchange = 'NGX')`;
  const out: string[] = ["BEGIN;"];

  if (ratios.length) {
    const vals = ratios.map((r) => `(${r.year}, ${n(r.revenue, 2)}::numeric, ${n(r.operatingIncome, 2)}::numeric, ${n(r.netIncome, 2)}::numeric)`).join(", ");
    out.push(
      `INSERT INTO financial_ratios (id, company_id, year, revenue, operating_income, net_income, source, is_canonical)\n` +
        `SELECT ${q(ID_PREFIX.ratio + ticker + "-")} || v.year, c.id, v.year, v.revenue, v.operating_income, v.net_income, '${NGX_SOURCE}'::data_source, true\n` +
        `FROM ${co} AS c(id), (VALUES ${vals}) AS v(year, revenue, operating_income, net_income)\n` +
        `ON CONFLICT (company_id, year, source) DO NOTHING;`,
    );
  }
  if (dividends.length) {
    const vals = dividends.map((d) => `(${d.year}, ${n(d.amount, 2)}::numeric)`).join(", ");
    out.push(
      `INSERT INTO dividends (id, company_id, year, amount, source, is_canonical)\n` +
        `SELECT ${q(ID_PREFIX.dividend + ticker + "-")} || v.year, c.id, v.year, v.amount, '${NGX_SOURCE}'::data_source, true\n` +
        `FROM ${co} AS c(id), (VALUES ${vals}) AS v(year, amount)\n` +
        `ON CONFLICT (company_id, year, source) DO NOTHING;`,
    );
  }
  if (documents.length) {
    const vals = documents.map((d) => `(${d.year}, ${q(d.url)}, ${q(d.filename || "")})`).join(", ");
    out.push(
      `INSERT INTO company_documents (id, company_id, title, filename, url, doc_type, period_label, source_name, updated_at)\n` +
        `SELECT ${q(ID_PREFIX.document + ticker + "-")} || v.year || '-' || substr(md5(v.url), 1, 8), c.id, 'Audited financial statements FY' || v.year, NULLIF(v.filename, ''), v.url, 'AUDITED_FS', 'FY' || v.year, 'NGX', now()\n` +
        `FROM ${co} AS c(id), (VALUES ${vals}) AS v(year, url, filename)\n` +
        `ON CONFLICT (company_id, url) DO NOTHING;`,
    );
  }
  if (meta.length) {
    const years: Record<string, Record<string, unknown>> = {};
    for (const m of meta) {
      const y: Record<string, unknown> = {};
      if (m.equityBn !== null) y.equityBn = Number(m.equityBn.toFixed(3));
      if (m.epsNgn !== null) y.epsNgn = Number(m.epsNgn.toFixed(4));
      if (m.sourceUrl) y.sourceUrl = m.sourceUrl;
      years[String(m.year)] = y;
    }
    // Priorité aux valeurs déjà en base : `nouveau || existant`.
    out.push(
      `UPDATE companies SET updated_at = now(), profile_meta = COALESCE(profile_meta, '{}'::jsonb) || jsonb_build_object('ngxFundamentals',\n` +
        `  COALESCE(profile_meta->'ngxFundamentals', '{}'::jsonb) || jsonb_build_object('years',\n` +
        `    ${q(JSON.stringify(years))}::jsonb || COALESCE(profile_meta->'ngxFundamentals'->'years', '{}'::jsonb)))\n` +
        `WHERE ticker = ${t} AND exchange = 'NGX';`,
    );
  }
  out.push("COMMIT;");
  return { ticker, counts: { ratios: ratios.length, meta: meta.length, dividends: dividends.length, documents: documents.length }, sql: out.join("\n") + "\n" };
}

export function plannedTickers(plan: LoadPlan): string[] {
  return [...new Set([...plan.ratios, ...plan.meta, ...plan.dividends, ...plan.documents].map((p) => p.ticker))].sort();
}

/** Lecture seule : ce que les scripts d'écriture vont créer, par société (comptes attendus). */
export function buildPreviewSql(tickers: string[]): string {
  const list = tickers.map(tickerSql).join(", ");
  return (
    `SELECT (SELECT count(*) FROM companies WHERE exchange = 'NGX' AND ticker IN (${list})) AS ngx_companies_found,\n` +
    `  (SELECT count(*) FROM financial_ratios fr JOIN companies c ON c.id = fr.company_id WHERE c.exchange = 'NGX' AND fr.source = '${NGX_SOURCE}') AS ratios_existing,\n` +
    `  (SELECT count(*) FROM dividends d JOIN companies c ON c.id = d.company_id WHERE c.exchange = 'NGX' AND d.source = '${NGX_SOURCE}') AS dividends_existing,\n` +
    `  (SELECT count(*) FROM company_documents d JOIN companies c ON c.id = d.company_id WHERE c.exchange = 'NGX' AND d.source_name = 'NGX') AS documents_existing,\n` +
    `  (SELECT count(*) FROM companies WHERE exchange = 'NGX' AND profile_meta ? 'ngxFundamentals') AS meta_existing;\n`
  );
}

/** Annule exactement le chargement (clés d'identifiants ngx-*, source NGX_OFFICIEL, sociétés NGX). */
export function buildRollbackSql(tickers: string[]): string {
  const list = tickers.map(tickerSql).join(", ");
  const ngx = `(SELECT id FROM companies WHERE exchange = 'NGX')`;
  return (
    `-- Rollback du chargement NGX (fondamentaux NGX_OFFICIEL). Ne touche aucune ligne BRVM ni aucune autre source.\n` +
    `BEGIN;\n` +
    `DELETE FROM financial_ratios WHERE source = '${NGX_SOURCE}' AND id LIKE '${ID_PREFIX.ratio}%' AND company_id IN ${ngx};\n` +
    `DELETE FROM dividends WHERE source = '${NGX_SOURCE}' AND id LIKE '${ID_PREFIX.dividend}%' AND company_id IN ${ngx};\n` +
    `DELETE FROM company_documents WHERE source_name = 'NGX' AND id LIKE '${ID_PREFIX.document}%' AND company_id IN ${ngx};\n` +
    `-- Ne retire que profile_meta.ngxFundamentals.years (sharesOutstanding, chargé séparément, est conservé) ; la clé est supprimée si elle devient vide.\n` +
    `UPDATE companies SET profile_meta = profile_meta #- '{ngxFundamentals,years}', updated_at = now()\n` +
    `WHERE exchange = 'NGX' AND profile_meta #> '{ngxFundamentals,years}' IS NOT NULL AND ticker IN (${list});\n` +
    `UPDATE companies SET profile_meta = profile_meta - 'ngxFundamentals', updated_at = now()\n` +
    `WHERE exchange = 'NGX' AND profile_meta->'ngxFundamentals' = '{}'::jsonb AND ticker IN (${list});\n` +
    `COMMIT;\n`
  );
}
