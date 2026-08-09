// ═══════════════════════════════════════════════════════════════════════════
// Autorisation partagée des points d'entrée cron — étape 10
// ═══════════════════════════════════════════════════════════════════════════
// Extrait de `app/api/cron/ingest/route.ts` (étape 6) SANS changement de
// comportement, pour être réutilisé par `app/api/cron/research/route.ts`.
// ═══════════════════════════════════════════════════════════════════════════

import type { NextRequest } from "next/server";

export function isCronAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Aucun secret configuré = configuration incomplète, jamais un "ouvert à
    // tous" par défaut — on refuse plutôt que de risquer un déclenchement
    // non maîtrisé en production.
    return false;
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${expected}`) return true;
  const querySecret = request.nextUrl.searchParams.get("secret");
  return querySecret === expected;
}
