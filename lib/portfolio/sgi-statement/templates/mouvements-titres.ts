/**
 * Modèle de référence : relevé de mouvements de titres, groupé par titre.
 *
 * Détection : les sept colonnes sont présentes, dans n'importe quel espacement,
 * ou comme en-tête de cellules Excel / CSV. L'application et la réconciliation
 * vivent dans `parse-mouvements.ts` (`reconcileMouvementLedger`).
 */

import { detectMouvementHeader, detectMouvementHeaderRow } from "../parse-mouvements";
import type { StatementTemplateProfile } from "./profile";

export const MOUVEMENTS_TITRES: StatementTemplateProfile = {
  id: "mouvements-titres",
  layoutId: "mouvements",
  label: "Relevé de mouvements de titres",
  family: "mouvements",
  columns: ["Titre", "Date", "Libellé", "Valeur unitaire", "Débit", "Crédit", "Solde"],
  rules: [
    "Famille : grand livre groupé par titre, pas une liste de positions ni une liste d'opérations à plat.",
    "Colonnes, dans cet ordre logique : Titre, Date, Libellé, Valeur unitaire, Débit, Crédit, Solde.",
    "Une ligne d'en-tête de groupe ne contient que le titre (parfois coupé sur deux lignes, par exemple FILTISAC COTE puis DIVOIRE) et le solde de clôture dans Solde. Les lignes de détail ont le titre vide et héritent de ce groupe.",
    "Une ligne « Solde au … » est un solde d'ouverture : sa quantité est le Solde de la ligne, ce n'est pas un achat. L'inclure quand même, pour servir de quantité de départ.",
    "En compte titres, Crédit = titres qui entrent (acquisition, achat, souscription) et Débit = titres qui sortent (cession, vente, rachat). Ne pas les inverser.",
    "Valeur unitaire : les espaces séparent les milliers et « .000 » est une décimale. « 8 520.000 » vaut 8520, « 16 300.000 » vaut 16300. Renvoyer un nombre, pas le texte.",
    "Solde est un solde courant. Il sert à vérifier la quantité nette ; ne pas le recopier comme une quantité d'achat.",
  ],
};

export function detectMouvementsText(text: string): boolean {
  return text.split("\n").slice(0, 40).some((line) => detectMouvementHeader(line) != null);
}

export function detectMouvementsMatrix(matrix: readonly (readonly string[])[]): boolean {
  return matrix.slice(0, 30).some((row) => detectMouvementHeaderRow(row));
}
