// Rattrapage des niveaux de confiance dans profile_meta.ngxFundamentals.years.<année> pour les chargements
// antérieurs, qui n'enregistraient que {equityBn, epsNgn, sourceUrl}. Génère du SQL — jamais exécuté ici.
//  - ne touche que des années DÉJÀ présentes en base, et n'ajoute que equityConfidence / epsConfidence ;
//  - une confiance n'est posée que si la valeur en base est égale à celle du CSV (tolérance d'arrondi) :
//    une valeur corrigée à la main après chargement (ex. Nigerian Breweries) n'hérite pas de la confiance du CSV ;
//  - équivalent à un `UPDATE` par société, dans une seule transaction, relançable sans effet de bord.
import { q } from "./load-sql";
import type { FundamentalsCsvRow } from "./load-plan";

const num = (s: string | undefined) => (s === undefined || s === "" || !Number.isFinite(Number(s)) ? null : Number(s));
const level = (c: string) => (c === "high" || c === "medium" || c === "low" ? c : null);

interface YearConf {
  year: number;
  equity: number | null;
  confEquity: string | null;
  eps: number | null;
  confEps: string | null;
}

export function collectYearConfidences(rows: FundamentalsCsvRow[]): Map<string, YearConf[]> {
  const out = new Map<string, Map<number, YearConf>>();
  for (const r of rows) {
    if (r.currency && r.currency !== "NGN") continue;
    if (!/^[A-Z0-9.\-&]+$/.test(r.ticker)) throw new Error(`ticker invalide : ${r.ticker}`);
    const year = Number(r.fiscal_year);
    const equity = num(r.equity_bn);
    const eps = num(r.eps);
    const confEquity = equity !== null ? level(r.conf_equity) : null;
    const confEps = eps !== null ? level(r.conf_eps) : null;
    if (confEquity === null && confEps === null) continue;
    const byYear = out.get(r.ticker) ?? new Map<number, YearConf>();
    if (!byYear.has(year)) byYear.set(year, { year, equity, confEquity, eps, confEps });
    out.set(r.ticker, byYear);
  }
  return new Map([...out].map(([t, m]) => [t, [...m.values()].sort((a, b) => a.year - b.year)]));
}

const lit = (v: number | null) => (v === null ? "NULL::numeric" : `${v}::numeric`);
const txt = (v: string | null) => (v === null ? "NULL::text" : `${q(v)}::text`);

/** Expression SQL du nouvel objet `years` d'une société (sans écriture). */
function yearsExpr(rows: YearConf[]): string {
  const vals = rows.map((r) => `(${q(String(r.year))}, ${lit(r.equity)}, ${txt(r.confEquity)}, ${lit(r.eps)}, ${txt(r.confEps)})`).join(", ");
  return (
    `(SELECT jsonb_object_agg(y.key, y.value\n` +
    `    || CASE WHEN v.conf_equity IS NOT NULL AND (y.value->>'equityBn') IS NOT NULL AND abs((y.value->>'equityBn')::numeric - v.equity) < 0.0006 THEN jsonb_build_object('equityConfidence', v.conf_equity) ELSE '{}'::jsonb END\n` +
    `    || CASE WHEN v.conf_eps IS NOT NULL AND (y.value->>'epsNgn') IS NOT NULL AND abs((y.value->>'epsNgn')::numeric - v.eps) < 0.00006 THEN jsonb_build_object('epsConfidence', v.conf_eps) ELSE '{}'::jsonb END)\n` +
    `  FROM jsonb_each(c.profile_meta->'ngxFundamentals'->'years') AS y\n` +
    `  LEFT JOIN (VALUES ${vals}) AS v(year, equity, conf_equity, eps, conf_eps) ON v.year = y.key)`
  );
}

/** UPDATE transactionnel (une instruction par société) — à relire puis exécuter par un humain. */
export function buildConfidenceBackfillSql(rows: FundamentalsCsvRow[]): string {
  const stmts: string[] = [
    "-- Rattrapage des niveaux de confiance (equityConfidence / epsConfidence). NON EXÉCUTÉ : à relire avant usage.",
    "-- N'ajoute que ces deux clés, sur des années déjà présentes, quand la valeur en base égale celle du CSV.",
    "BEGIN;",
  ];
  for (const [ticker, list] of collectYearConfidences(rows)) {
    stmts.push(
      `UPDATE companies c SET profile_meta = jsonb_set(c.profile_meta, '{ngxFundamentals,years}', ${yearsExpr(list)})\n` +
        `WHERE c.exchange = 'NGX' AND c.ticker = ${q(ticker)} AND jsonb_typeof(c.profile_meta->'ngxFundamentals'->'years') = 'object';`,
    );
  }
  stmts.push("COMMIT;");
  return stmts.join("\n") + "\n";
}

/** Même calcul en lecture seule : renvoie, par société, les `years` qui résulteraient du rattrapage. */
export function buildConfidencePreviewSql(rows: FundamentalsCsvRow[]): string {
  const parts: string[] = [];
  for (const [ticker, list] of collectYearConfidences(rows)) {
    parts.push(
      `SELECT c.ticker, ${yearsExpr(list)} AS years FROM companies c ` +
        `WHERE c.exchange = 'NGX' AND c.ticker = ${q(ticker)} AND jsonb_typeof(c.profile_meta->'ngxFundamentals'->'years') = 'object'`,
    );
  }
  return parts.join("\nUNION ALL\n") + ";\n";
}
