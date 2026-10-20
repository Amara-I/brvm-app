/**
 * Étapes 1 et 2 : parcourir les familles dans l'ordre
 * mouvements → opérations → positions, et garder le premier modèle qui lit
 * quelque chose. Les étapes 3 et 4 sont dans le `run` de chaque modèle
 * (réconciliation) puis dans `finalizeStatement` (confiance expliquée).
 */

import type { TemplateCandidate } from "./profile";

export function firstTemplate(groups: readonly (readonly TemplateCandidate[])[]): {
  templateId: string;
  family: TemplateCandidate["family"];
  layoutId: string;
  label: string;
  draft: NonNullable<ReturnType<TemplateCandidate["run"]>>;
} | null {
  for (const group of groups) {
    for (const candidate of group) {
      const draft = candidate.run();
      if (!draft) continue;
      return {
        templateId: candidate.templateId,
        family: candidate.family,
        layoutId: draft.layoutId ?? candidate.layoutId,
        label: draft.label ?? candidate.label,
        draft,
      };
    }
  }
  return null;
}
