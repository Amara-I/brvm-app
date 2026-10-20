import type { LayoutFamily } from "./profile";
import type { MatchReason, StatementRowDraft } from "../types";

const REASON: Record<MatchReason, string> = {
  isin: "code ISIN",
  ticker: "code valeur",
  alias: "alias SGI",
  nom: "nom de la société",
  approche: "nom approché",
  aucune: "aucune correspondance",
};

const CONFIDENCE_WORD = {
  haute: "haute",
  moyenne: "moyenne",
  faible: "faible",
  aucune: "aucune",
} as const;

function reconciliationSentence(family: LayoutFamily): string {
  if (family === "mouvements") return "Quantité nette et PRU pondéré, solde du relevé confirmé.";
  if (family === "operations") return "Quantité nette et PRU pondéré des opérations.";
  return "Quantité lue sur le relevé de positions.";
}

/** Phrase courte affichée sous le badge de confiance. */
export function explainConfidence(
  row: Pick<StatementRowDraft, "match" | "warnings" | "instrumentKind">,
  family: LayoutFamily
): string {
  const warning = row.warnings.find((item) =>
    /solde|incomplet|contredit|calculée|plusieurs|aucune société|quantité manquante/i.test(item)
  );
  if ((row.match.confidence === "faible" || row.match.confidence === "aucune") && warning) return warning;
  if (row.instrumentKind !== "action") {
    return "Obligation ou FCP : le nom est repris du relevé, sans rapprochement avec une action cotée.";
  }
  const via = REASON[row.match.reason];
  const ticker = row.match.ticker ? ` ${row.match.ticker}` : "";
  const level = CONFIDENCE_WORD[row.match.confidence];
  return `Confiance ${level} : ${via} vers${ticker}. ${reconciliationSentence(family)}`;
}
