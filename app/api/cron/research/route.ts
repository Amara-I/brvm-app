// ═══════════════════════════════════════════════════════════════════════════
// GET /api/cron/research — Veille + propositions design journalières
// ═══════════════════════════════════════════════════════════════════════════
// Auth : Bearer CRON_SECRET ou ?secret= (comme /api/cron/ingest).
// Planifié quotidiennement 06:00 UTC (vercel.json) — nécessite
// RESEARCH_AGENT_ENABLED=true (fallback Google News RSS sans clé SerpAPI).
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { runResearchAgent } from "@/lib/research/run-research-agent";
import { isCronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  try {
    const summary = await runResearchAgent();
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "Échec de l'agent de recherche", details: message },
      { status: 500 }
    );
  }
}
