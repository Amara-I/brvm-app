// Cadre App Designer — ranking & schémas de proposition (pas d'auto-merge).

export type EvidenceStrength =
  | "inspiration"
  | "repeated_pattern"
  | "validated_practice"
  | "internal_evidence";

export type DesignRisk = "low" | "medium" | "high";

export type DesignSurface =
  | "homepage"
  | "marche"
  | "screener"
  | "fiche"
  | "graphes"
  | "auth"
  | "autre";

export interface DesignFindingDraft {
  sourceUrl: string;
  title: string;
  summary?: string;
  category: "DESIGN" | "UX" | "FONCTIONNALITE" | "CONCURRENCE" | "CONTENU";
  patternName?: string;
  surface?: DesignSurface;
  evidenceStrength: EvidenceStrength;
  impact: number; // 1–5
  confidence: number;
  reach: number;
  reversibility: number;
  effort: number;
  risk: number;
}

export interface DesignProposalMeta {
  id: string;
  date: string;
  risk: DesignRisk;
  surface: DesignSurface;
  evidenceUrls: string[];
  evidenceStrength: EvidenceStrength;
  rankingScore: number;
  hypothesis: string;
  affectedPaths: string[];
}

/** Score de priorité App Designer. */
export function rankDesignIdea(f: Pick<
  DesignFindingDraft,
  "impact" | "confidence" | "reach" | "reversibility" | "effort" | "risk"
>): number {
  const effort = Math.max(1, f.effort);
  const risk = Math.max(1, f.risk);
  return (f.impact * f.confidence * f.reach * f.reversibility) / (effort * risk);
}

export function canAutoPropose(evidence: EvidenceStrength, rankingScore: number): boolean {
  const okEvidence = evidence === "repeated_pattern" || evidence === "validated_practice" || evidence === "internal_evidence";
  return okEvidence && rankingScore >= 8;
}

/** Chemins protégés — l'agent Designer ne doit pas les modifier sans ordre explicite. */
export const DESIGN_PROTECTED_PATH_GLOBS = [
  "lib/calc/**",
  "lib/ingestion/**",
  "prisma/migrations/**",
  "lib/auth/**",
  ".env*",
  "app/mentions-legales/**",
] as const;

export function isProtectedPath(path: string): boolean {
  const p = path.replace(/\\/g, "/");
  if (p.includes("lib/calc/") || p.includes("lib/ingestion/") || p.includes("lib/auth/")) return true;
  if (p.includes("prisma/migrations/") || p.startsWith(".env")) return true;
  if (p.includes("mentions-legales")) return true;
  return false;
}

export function formatProposalMarkdown(meta: DesignProposalMeta, body: {
  problem: string;
  proposal: string;
  acceptance: string[];
}): string {
  return `# Proposition App Designer — ${meta.id}

| Champ | Valeur |
|-------|--------|
| ID | ${meta.id} |
| Date | ${meta.date} |
| Risque | ${meta.risk} |
| Surface | ${meta.surface} |
| Ranking | ${meta.rankingScore.toFixed(2)} |
| Evidence | ${meta.evidenceStrength} |
| Statut | pending |
| Aperçu | [/apercu-design#${meta.id}](/apercu-design#${meta.id}) |

## Evidence

${meta.evidenceUrls.map((u) => `- ${u}`).join("\n") || "- (aucune URL)"}

## Problème

${body.problem}

## Proposition

${body.proposal}

## Fichiers impactés

${meta.affectedPaths.map((f) => `- \`${f}\``).join("\n") || "- (à préciser)"}

## Critères d'acceptation

${body.acceptance.map((a) => `- [ ] ${a}`).join("\n")}

## Hypothèse KPI

${meta.hypothesis}

## Rollback

\`\`\`bash
git revert <sha>
\`\`\`
`;
}
