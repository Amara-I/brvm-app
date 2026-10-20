/**
 * Modèle « operations » : liste à plat d'achats et de ventes.
 *
 * Détection : une colonne Sens (ou les mots Achat / Vente). La réconciliation
 * agrège par titre : quantité nette, PRU pondéré, date du premier achat.
 * Une quantité nette nulle est une position soldée.
 */

import type { StatementTemplateProfile } from "./profile";

export const OPERATIONS: StatementTemplateProfile = {
  id: "operations",
  layoutId: "positions",
  label: "Une position par titre",
  family: "operations",
  columns: ["Date", "Libellé", "Sens", "Quantité", "Cours"],
  rules: [
    "Famille : liste d'opérations à plat. Chaque ligne a un sens Achat ou Vente.",
    "Ne pas agréger dans le JSON : une ligne du relevé = une entrée rows.",
    "side vaut achat ou vente. quantity et unitPrice sont des nombres. date est YYYY-MM-DD ou null.",
    "Ignorer totaux, espèces, frais, adresses et numéros de page.",
  ],
};
