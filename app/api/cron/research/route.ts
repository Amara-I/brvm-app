// ═══════════════════════════════════════════════════════════════════════════
// GET /api/cron/research — Point d'entrée de l'agent de recherche IA, étape 10
// ═══════════════════════════════════════════════════════════════════════════
// Même mécanisme d'autorisation que `/api/cron/ingest` (étape 6) —
// `Authorization: Bearer ${CRON_SECRET}` (injecté par Vercel Cron) ou
// `?secret=` pour un déclenchement manuel. Cron hebdomadaire (cf. vercel.json)
// : la veille produit/UX n'a pas besoin d'une fraîcheur quotidienne comme les
// cours de bourse.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { runResearchAgent } from "@/lib/research/run-research-agent";
import { isCronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  try {
    const summary = await runResearchAgent();
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: "Échec de l'agent de recherche", details: message }, { status: 500 });
  }
}
