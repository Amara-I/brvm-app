// Dette financière, flux d'exploitation et capex par exercice (en milliards de la devise du document),
// à partir des documents retenus par la validation (un AFS par exercice). Aucune I/O.
// Confiance : « high » si la colonne « exercice précédent » de l'AFS suivant redonne la même valeur (±1 %),
// « medium » si lue une seule fois (pas d'AFS suivant ou pas de ligne comparable), « low » si contredite.
import type { ExtractedDoc } from "./validate";
import type { Confidence, RawField } from "./types";

export type ExtraField = "borrowings" | "operatingCashFlow" | "capex";
export const EXTRA_FIELDS: ExtraField[] = ["borrowings", "operatingCashFlow", "capex"];

export interface ExtraValue {
  valueBn: number;
  confidence: Confidence;
  /** Valeur relue dans le comparatif de l'AFS suivant, quand elle diffère. */
  restatedBn: number | null;
  page: number;
  label: string;
}

export interface ExtrasRow {
  ticker: string;
  fiscalYear: number;
  sourcePdf: string;
  fields: Partial<Record<ExtraField, ExtraValue>>;
}

const AGREE = 0.01;
const rel = (a: number, b: number) => (a === b ? 0 : Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)));

function scaled(f: RawField | undefined, mult: number | null, i: 0 | 1): number | null {
  if (!f || mult == null) return null;
  const v = f.values[i];
  return v == null ? null : (v * mult) / 1e9;
}

/**
 * @param chosen exercice → nom de fichier du document retenu par la validation (fundamentals.csv : source_file).
 */
export function buildExtrasRows(ticker: string, docs: readonly ExtractedDoc[], chosen: ReadonlyMap<number, string>): ExtrasRow[] {
  const byFile = new Map(docs.map((d) => [d.file, d]));
  const out: ExtrasRow[] = [];
  for (const [fy, file] of [...chosen.entries()].sort((a, b) => a[0] - b[0])) {
    const doc = byFile.get(file);
    if (!doc || doc.extraction.fiscalYear !== fy) continue;
    const next = chosen.has(fy + 1) ? byFile.get(chosen.get(fy + 1)!) : undefined;
    const row: ExtrasRow = { ticker, fiscalYear: fy, sourcePdf: doc.url, fields: {} };
    for (const k of EXTRA_FIELDS) {
      const raw = doc.extraction[k];
      const cur = scaled(raw, doc.extraction.unitMultiplier, 0);
      if (cur == null || !raw) continue;
      const prior = next && next.extraction.fiscalYear === fy + 1 ? scaled(next.extraction[k], next.extraction.unitMultiplier, 1) : null;
      let confidence: Confidence = "medium";
      let restatedBn: number | null = null;
      if (prior != null) {
        if (rel(cur, prior) <= AGREE) confidence = "high";
        else {
          confidence = "low";
          restatedBn = prior;
        }
      }
      row.fields[k] = { valueBn: cur, confidence, restatedBn, page: raw.page, label: raw.label };
    }
    if (Object.keys(row.fields).length) out.push(row);
  }
  return out;
}

const RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1, none: 0 };
export const minConfidence = (...c: Confidence[]): Confidence => c.reduce((a, b) => (RANK[a] <= RANK[b] ? a : b));

/** FCF = flux d'exploitation − capex (milliards). Confiance = la plus faible des deux. */
export function freeCashFlow(row: ExtrasRow): { valueBn: number; confidence: Confidence } | null {
  const cfo = row.fields.operatingCashFlow;
  const capex = row.fields.capex;
  if (!cfo || !capex) return null;
  return { valueBn: cfo.valueBn - Math.abs(capex.valueBn), confidence: minConfidence(cfo.confidence, capex.confidence) };
}

/** Ratio d'endettement (%) = dettes financières ÷ capitaux propres. null si capitaux propres ≤ 0. */
export function debtRatioPercent(borrowingsBn: number, equityBn: number | null): number | null {
  if (equityBn == null || !(equityBn > 0)) return null;
  return (borrowingsBn / equityBn) * 100;
}
