// ═══════════════════════════════════════════════════════════════════════════
// GET /api/cron/research — Veille du lundi + hook propositions de portefeuille
// ═══════════════════════════════════════════════════════════════════════════
// Auth : Bearer CRON_SECRET ou ?secret= (comme /api/cron/ingest).
// Planifié le lundi 06:00 UTC (vercel.json) — la veille nécessite
// RESEARCH_AGENT_ENABLED=true (fallback Google News RSS sans clé SerpAPI).
// Après la veille (même si elle échoue), `runWeeklyPortfolioProposals` est
// le point d'extension de l'e-mail hebdomadaire de propositions de portefeuille.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { runWeeklyPortfolioProposals, type WeeklyPortfolioProposalsResult } from "@/lib/cron/monday-hooks";
import { runResearchAgent } from "@/lib/research/run-research-agent";
import { isCronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  let research: Awaited<ReturnType<typeof runResearchAgent>> | null = null;
  let researchError: string | null = null;
  try {
    research = await runResearchAgent();
  } catch (err) {
    researchError = err instanceof Error ? err.message : String(err);
  }

  let portfolioProposals: WeeklyPortfolioProposalsResult;
  try {
    portfolioProposals = await runWeeklyPortfolioProposals();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[research] propositions de portefeuille : ${message}`);
    portfolioProposals = { ran: false, skipped: false, reason: message };
  }

  if (researchError) {
    return NextResponse.json(
      { ok: false, error: "Échec de l'agent de recherche", details: researchError, portfolioProposals },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, data: research, portfolioProposals });
}
