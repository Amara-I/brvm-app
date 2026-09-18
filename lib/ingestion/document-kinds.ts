// Classifie les documents émetteur (catalogue BRVM via OuestBourse).
// Aucun PDF inventé : on ne fait que lire type / intitulé / nom de fichier.

export type CompanyDocumentKind = "results" | "other";

const RESULTS_RE =
  /r[ée]sultats?|etats?\s*financiers?|[ée]tats?\s*financiers?|compte[s]?[\s_-]*(annuel|consolid|semestriel|social)|rapport[\s_-]*(annuel|financier|d.?activit)|semestriel|trimestriel|interimaire|int[ée]rims?|financial[\s_-]*statements?|earnings|annual[\s_-]*report|etats?\s*financiers/i;

const EXCLUDE_ONLY_RE =
  /dividende|coupon|convocation|assembl[ée]e|avis\s*de\s*r[ée]union|pv\s*d.?ag|actionnariat|statuts/i;

export function isResultsPublication(input: {
  docType?: string | null;
  title?: string | null;
  filename?: string | null;
  periodLabel?: string | null;
}): boolean {
  const hay = [input.docType, input.title, input.filename, input.periodLabel]
    .filter((s) => s && s.trim())
    .join(" ");
  if (!hay) return false;
  if (RESULTS_RE.test(hay)) return true;
  if (EXCLUDE_ONLY_RE.test(hay)) return false;
  return false;
}

export function companyDocumentKind(input: {
  docType?: string | null;
  title?: string | null;
  filename?: string | null;
  periodLabel?: string | null;
}): CompanyDocumentKind {
  return isResultsPublication(input) ? "results" : "other";
}
