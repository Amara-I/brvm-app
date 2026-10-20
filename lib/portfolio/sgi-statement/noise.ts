import { fold } from "./fold";
import type { IgnoreReason, InstrumentKind } from "./types";

export const IGNORE_REASON_LABEL: Record<IgnoreReason, string> = {
  vide: "Ligne vide",
  "en-tete": "En-tête de colonnes",
  adresse: "Adresse ou identité du client",
  page: "Numéro de page",
  disclaimer: "Mention légale",
  especes: "Espèces ou liquidités",
  frais: "Frais ou commission",
  total: "Total ou sous-total",
  section: "Titre de section",
  "sans-instrument": "Pas une ligne de titre",
  soldee: "Position soldée",
  couverte: "Déjà couverte par les opérations",
};

const PAGE_RE = /^(page\b|\d+\s*\/\s*\d+$)/;
const DISCLAIMER_RE =
  /disclaimer|avertissement|ne constitue pas|indicatif|confidentiel|mentions legales|tous droits|conseil en investissement/;
const CASH_RE = /\b(especes|espece|liquidites|disponibilites|solde especes|compte especes|cash)\b/;
const FEE_RE = /\b(courtage|commission|frais|tva|taxe|droit de garde|droits de garde)\b/;
const TOTAL_RE = /^(total|sous total|portefeuille global|net a payer|solde general|total general)\b|\b(total general|sous total|net a payer)\b/;
const ADDRESS_RE =
  /^(tel|telephone|fax|email|e mail|mail|adresse|rib|iban|compte|client|agence|domicile|bp|boite postale|siege)\b|\biban\b|\b(e mail|email)\b/;
const SECTION_RE =
  /^(historique|mouvements|operations|avis d|detail|releve\b|situation\b|portefeuille titres|arrete\b|page de garde)\b/;

/** Pourquoi une ligne de relevé n'est pas une position. `null` si elle peut l'être. */
export function classifyNoise(line: string): IgnoreReason | null {
  const folded = fold(line);
  if (!folded) return "vide";
  if (PAGE_RE.test(folded) || /\bpage\s+\d+\b/.test(folded)) return "page";
  if (DISCLAIMER_RE.test(folded)) return "disclaimer";
  if (CASH_RE.test(folded)) return "especes";
  if (FEE_RE.test(folded)) return "frais";
  if (TOTAL_RE.test(folded)) return "total";
  if (ADDRESS_RE.test(folded) || /@/.test(line)) return "adresse";
  if (SECTION_RE.test(folded) && !/\d{3,}/.test(folded.replace(/\d{1,2}\s+\d{1,2}\s+\d{2,4}/, ""))) return "section";
  return null;
}

const BOND_RE = /\b(obligation|obligations|oblig|obl|emprunt|emprunts|eos)\b|echeance/;
const FUND_RE = /\b(fcp|sicav|opcvm|fonds commun|fonds)\b/;

/** Classe une ligne de titre. Les mots-clés l'emportent sur un rapprochement action. */
export function classifyInstrument(label: string): InstrumentKind {
  const folded = fold(label);
  if (FUND_RE.test(folded)) return "fcp";
  if (BOND_RE.test(folded) || /\d+[,.]\d+\s*%/.test(label)) return "obligation";
  return "action";
}
