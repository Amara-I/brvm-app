// ═══════════════════════════════════════════════════════════════════════════
// Dérivation du statut d'un run d'ingestion — logique pure, testable
// ═══════════════════════════════════════════════════════════════════════════

export type IngestionRunStatus = "SUCCESS" | "PARTIAL" | "FAILED";

export interface CallOutcome {
  /// `false` si l'appel a été volontairement désactivé (cf. connector-config.ts)
  /// — ne compte alors ni comme un succès ni comme un échec.
  attempted: boolean;
  ok: boolean;
}

/// Dérive le statut global du run d'UNE source à partir du résultat de ses
/// appels (indices + cotations). Règles :
///   - Aucun appel tenté (tout désactivé) → "PARTIAL" (rien n'a pu être vérifié).
///   - Tous les appels tentés ont réussi → "SUCCESS".
///   - Tous les appels tentés ont échoué → "FAILED".
///   - Mélange de réussites/échecs → "PARTIAL".
export function deriveSourceRunStatus(outcomes: CallOutcome[]): IngestionRunStatus {
  const attempted = outcomes.filter((o) => o.attempted);
  if (attempted.length === 0) return "PARTIAL";
  const failed = attempted.filter((o) => !o.ok);
  if (failed.length === 0) return "SUCCESS";
  if (failed.length === attempted.length) return "FAILED";
  return "PARTIAL";
}
