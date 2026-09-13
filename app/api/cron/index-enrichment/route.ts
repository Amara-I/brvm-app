// GET /api/cron/index-enrichment — historique + composition des indices.
// Non listé dans vercel.json (quota Hobby = 2 crons). Déclenchement manuel :
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "https://<host>/api/cron/index-enrichment?budgetMs=240000"
//
// Query :
//   codes=BRVM_COMPOSITE,BRVM_30
//   dailyFrom=2025-07-01
//   noDaily=1 · noAnnual=1 · noMonthly=1 · compositionOnly=1 · historyOnly=1
//   force=1 · budgetMs=240000
//
// POST = GET (certains outils n'envoient que POST).

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { runIndexEnrichment } from "@/lib/ingestion/run-index-enrichment";
import { sendIngestionAlert } from "@/lib/ingestion/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const codes = params.get("codes")?.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  const dailyFrom = params.get("dailyFrom");
  const budgetMs = Number(params.get("budgetMs"));
  const compositionOnly = params.get("compositionOnly") === "1";
  const historyOnly = params.get("historyOnly") === "1";

  try {
    const summary = await runIndexEnrichment({
      codes: codes && codes.length ? codes : undefined,
      includeComposition: compositionOnly || !historyOnly,
      includeHistory: historyOnly || !compositionOnly,
      includeAnnual: params.get("noAnnual") !== "1" && !compositionOnly,
      includeMonthly: params.get("noMonthly") !== "1" && !compositionOnly,
      includeDaily: params.get("noDaily") !== "1" && !compositionOnly,
      dailyFrom: dailyFrom && /^\d{4}-\d{2}-\d{2}$/.test(dailyFrom) ? dailyFrom : undefined,
      timeBudgetMs: Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : 240_000,
      force: params.get("force") === "1",
    });
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendIngestionAlert({
      severity: "critical",
      title: "Échec de l'enrichissement des indices",
      message,
    });
    return NextResponse.json({ ok: false, error: "Échec de l'enrichissement", details: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
