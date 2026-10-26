// GET/POST /api/cron/corporate-actions
// Upsert du catalogue de fractionnements, vérification d'historique,
// rebuild de chart_series. Protégé par CRON_SECRET.
//
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "https://<host>/api/cron/corporate-actions?budgetMs=240000"
//   ?symbols=SNTS,PRSC  (optionnel)

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { applyCorporateActions } from "@/lib/corporate-actions/apply-run";
import { sendIngestionAlert } from "@/lib/ingestion/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams;
  const budgetMs = Number(q.get("budgetMs") ?? "240000");
  const symbols = q
    .get("symbols")
    ?.split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  try {
    const summary = await applyCorporateActions({
      tickers: symbols?.length ? symbols : undefined,
      timeBudgetMs: Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : 240_000,
      verifyHistory: q.get("verify") !== "0",
    });
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendIngestionAlert({
      severity: "critical",
      title: "Échec de l'application des fractionnements",
      message,
    });
    return NextResponse.json(
      { ok: false, error: "Échec de l'application des fractionnements", details: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
