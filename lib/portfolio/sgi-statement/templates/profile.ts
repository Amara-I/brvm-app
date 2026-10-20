/**
 * Modèle de relevé SGI.
 *
 * L'import suit toujours les quatre étapes :
 *   1. détecter la famille (positions nettes, mouvements groupés, opérations) ;
 *   2. appliquer le modèle dont les règles de détection collent ;
 *   3. réconcilier (quantité nette, PRU pondéré, solde courant) ;
 *   4. expliquer la confiance de chaque ligne.
 *
 * Pour en ajouter un : `docs/import-releve-sgi.md`, section « Ajouter un modèle ».
 */

import type { DocumentKind, IgnoredLine, LayoutFamily, StatementRowDraft } from "../types";

export type { LayoutFamily };

export const LAYOUT_FAMILIES = ["mouvements", "operations", "positions"] as const satisfies readonly LayoutFamily[];

export type TemplateDraft = {
  rows: StatementRowDraft[];
  ignored: IgnoredLine[];
  ignoredCount: number;
  documentKind: DocumentKind;
  /** Remplace l'identifiant de mise en page du modèle si un sous-format gagne. */
  layoutId?: string;
  label?: string;
};

export type TemplateCandidate = {
  templateId: string;
  family: LayoutFamily;
  layoutId: string;
  label: string;
  /** Détecte et réconcilie. `null` si ce n'est pas ce modèle. */
  run: () => TemplateDraft | null;
};

/** Profil nommé : règles de détection + texte montré au modèle de vision. */
export type StatementTemplateProfile = {
  /** Nom stable (`mouvements-titres`, `positions`, `operations`). */
  id: string;
  /** Valeur historique de `layoutId` renvoyée à l'aperçu. */
  layoutId: string;
  label: string;
  family: LayoutFamily;
  /** Colonnes attendues, dans l'ordre, quand le relevé est un tableau. */
  columns: readonly string[];
  /** Règles lues par un développeur et recopiées dans le prompt de vision. */
  rules: readonly string[];
};
