// Dividende par action (DPS) : lecture déterministe dans le texte d'un rapport d'états financiers audités.
// Deux sources : (1) tableau « Dividend per share » (colonnes exercice / exercice précédent),
// (2) phrase « the Directors proposed a dividend of ₦X per share (2024: ₦Y) ».
import { norm, parsePage, splitPages } from "./text";

export interface DividendCandidate {
  /** Exercice auquel le dividende se rapporte (au titre de l'exercice). */
  fiscalYear: number;
  /** Dividende par action en ₦ (ou devise de présentation). */
  dps: number;
  kind: "total" | "final" | "interim" | "unspecified";
  source: "table" | "text";
  page: number;
  snippet: string;
  /** Somme interim + final proposé lue dans deux phrases/lignes du même document. */
  derived?: boolean;
}

const NUM = String.raw`(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)`;
const CUR = String.raw`(?:₦|N|NGN|NGN\s|naira\s)?\s?`;

function toNaira(value: string, kobo: boolean): number {
  const v = Number(value.replace(/,/g, ""));
  return kobo ? v / 100 : v;
}

/**
 * @param text texte complet `pdftotext -layout` (pages séparées par \f)
 * @param fy exercice du document (cible : valeur « courante » ; la colonne précédente donne fy-1)
 */
export function extractDividends(text: string, fy: number): DividendCandidate[] {
  const out: DividendCandidate[] = [];
  const pages = splitPages(text);
  pages.forEach((pg, pi) => {
    // (1) Tableau : « Proposed dividend per share (Naira) 3.20 3.10 3.20 3.10 »
    for (const r of parsePage(pg)) {
      const l = norm(r.label);
      if (!/^(?:total\s+|proposed\s+|final\s+|interim\s+)?(?:dividends?\s+per\s+(?:ordinary\s+)?share|dps)\b/.test(l) || /\bpayout|cover|yield/.test(l)) continue;
      if (r.nums.length < 1) continue;
      const kobo = /kobo|\(k\)/i.test(r.raw) && !/naira/i.test(r.label);
      const kind: DividendCandidate["kind"] = /^interim/.test(l) ? "interim" : /^final/.test(l) ? "final" : /^(?:total|proposed)/.test(l) || /^dividends? per/.test(l) ? "total" : "unspecified";
      const nums = r.nums.filter((n) => n >= 0);
      if (!nums.length) continue;
      const cur = nums[0];
      out.push({ fiscalYear: fy, dps: toNaira(String(cur), kobo), kind, source: "table", page: pi + 1, snippet: r.raw.trim().replace(/\s+/g, " ").slice(0, 200) });
      if (nums.length >= 2) {
        // Avec colonnes Groupe/Société : [g_cur, g_prior, c_cur, c_prior] ; sinon [cur, prior]
        const prior = nums.length >= 4 ? nums[1] : nums[1];
        out.push({ fiscalYear: fy - 1, dps: toNaira(String(prior), kobo), kind, source: "table", page: pi + 1, snippet: r.raw.trim().replace(/\s+/g, " ").slice(0, 200) });
      }
    }
    // (2) Phrases
    const flat = pg.replace(/\s+/g, " ");
    const re = new RegExp(
      String.raw`(?:propos|recommend|declar|paid|approv)[a-z]*[^.;]{0,80}?(final\s+|interim\s+|total\s+)?dividend\s+of\s+${CUR}${NUM}\s?(k\b|kobo)?[^.]{0,20}?\s+per\s+(?:ordinary\s+)?(?:50\s?kobo\s+|share)`,
      "gi",
    );
    for (const m of flat.matchAll(re)) {
      const kind = /final/i.test(m[1] ?? "") ? "final" : /interim/i.test(m[1] ?? "") ? "interim" : /total/i.test(m[1] ?? "") ? "total" : "unspecified";
      const tail = flat.slice(m.index!, m.index! + 330);
      const inRespect = /current\s+year|in\s+respect\s+of\s+the\s+(?:financial\s+)?year|financial\s+year/i.test(flat.slice(Math.max(0, m.index! - 80), m.index! + 80));
      const dps = toNaira(m[2], !!m[3]);
      // la phrase d'approbation en assemblée (« On 17 June, a dividend ... was approved ») concerne l'exercice précédent
      const approved = /was\s+approved\s+by\s+shareholders|was\s+paid|paid\s+to\s+holders/i.test(tail.slice(0, 200)) && !inRespect && /\bon\s+\d{1,2}(?:st|nd|rd|th)?\s+[a-z]+\s+20\d\d/i.test(flat.slice(Math.max(0, m.index! - 60), m.index! + 20));
      if (approved) continue;
      out.push({ fiscalYear: fy, dps, kind, source: "text", page: pi + 1, snippet: tail.slice(0, 220) });
      const prior = new RegExp(String.raw`\(\s*(?:dec(?:ember)?\s+|31\s+december\s+)?(20\d\d)\s*:\s*(?:interim[;:,]?\s*)?${CUR}${NUM}\s?(k\b|kobo)?`, "i").exec(tail);
      if (prior && Number(prior[1]) === fy - 1 && !/interim\s*[;:]/i.test(tail)) out.push({ fiscalYear: fy - 1, dps: toNaira(prior[2], !!prior[3]), kind, source: "text", page: pi + 1, snippet: tail.slice(0, 220) });
    }
  });
  // Total « au titre de l'exercice » = interim payé + final proposé (évite le total « déclaré pendant l'exercice »,
  // qui contient le final de l'exercice précédent).
  const fin = out.find((c) => c.fiscalYear === fy && c.kind === "final" && c.source === "text");
  const itm = out.find((c) => c.fiscalYear === fy && c.kind === "interim");
  if (fin && itm) {
    out.push({ fiscalYear: fy, dps: Math.round((fin.dps + itm.dps) * 1e6) / 1e6, kind: "total", source: "text", page: fin.page, snippet: `final ${fin.dps} (p${fin.page}) + interim ${itm.dps} (p${itm.page})`, derived: true });
  }
  return out;
}

/** Choisit le meilleur DPS pour un exercice parmi les candidats (tableau « total » > phrase « total » > phrase). */
export function bestDividend(cands: DividendCandidate[]): DividendCandidate | null {
  const rank = (c: DividendCandidate) =>
    c.derived ? 0 : (c.source === "table" ? 1 : 10) + (c.kind === "total" ? 0 : c.kind === "unspecified" ? 1 : c.kind === "final" ? 2 : 3);
  const ok = cands.filter((c) => c.dps > 0 && c.dps < 1000);
  if (!ok.length) return null;
  return ok.slice().sort((a, b) => rank(a) - rank(b) || a.page - b.page)[0];
}
