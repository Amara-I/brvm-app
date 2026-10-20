/**
 * Modèle « positions » : liste à plat de lignes déjà nettes.
 *
 * Pas de colonne Sens, pas de Débit/Crédit. La quantité du relevé est la
 * quantité à importer. Sous-formats : tableau (`colonnes` / `matrice`),
 * blocs « Libellé : valeur », lignes libres. La réconciliation est l'identité.
 */

import type { StatementTemplateProfile } from "./profile";

export const POSITIONS: StatementTemplateProfile = {
  id: "positions",
  layoutId: "colonnes",
  label: "Relevé de positions",
  family: "positions",
  columns: ["Code ou libellé", "Quantité", "PRU ou cours ou valorisation"],
  rules: [
    "Famille : liste de positions déjà nettes. Chaque ligne est un titre détenu, pas un mouvement.",
    "Pas de regroupement par titre, pas de colonnes Débit / Crédit / Solde courant.",
    "side reste null. quantity est la quantité déjà nette. unitPrice est le PRU s'il est imprimé.",
    "Ignorer totaux, espèces, frais, adresses et numéros de page.",
  ],
};
