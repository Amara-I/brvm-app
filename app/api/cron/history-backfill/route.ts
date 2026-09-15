// GET /api/cron/history-backfill — rattrapage historique Sika (cron-safe).
// Non listé dans vercel.json (quota Hobby = 2 crons : ingest + research).
// Déclenchement manuel / scheduler externe :
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "https://<host>/api/cron/history-backfill?budgetMs=240000"
//
// Query :
//   tickers=SNTS,SGBC     restreint le run
//   dailyFrom=1Y|auto|YYYY-MM-DD|off   (défaut 1Y via INGESTION_DAILY_FROM)
//   maxTickers=5
//   after=SNTS            reprend APRÈS ce ticker (exclusif)
//   noSheets=1 · noDaily=1 · noEvents=1 · noDocs=1 · noResume=1
//   budgetMs=240000       plafond Hobby (défaut 240 s)
//   maxDailyChunks=8      fenêtres GetHistos journalières / ticker / run
//   minDailyPoints=35     seuil de densité pour skip une fenêtre (défaut 35)
//   forceDaily=1          ignore INGESTION_ENABLE_SIKA_DAILY_HISTORY=false
//                         et planifie les gaps (seuil 35 sauf minDailyPoints=)
//
// Diagnostic par ticker : includeDaily, flagDaily, dailyFromIso,
// dailyGapsPlanned, dailyChunksFetched, dailyChunksSatisfied,
// dailyGapsRemaining, existingPoints, dailySkipReason.
//
// GetHistos plafonne souvent ~28 clôtures / 89 j (< 35). Un fetch réussi
// sans nouvel upsert marque la fenêtre « source épuisée » (persistance dans
// ingestion_logs) pour ne pas reboucler à l'infini sur le même ticker.
// minDailyPoints=20 reste un override ops possible, plus nécessaire pour ce stall.
//
// Ex. densifier BICC malgré un flag daily off en prod :
//   .../history-backfill?forceDaily=1&maxTickers=1&tickers=BICC
//
// Note : minDailyPoints=1 ne refetch QUE les fenêtres à 0 point (les années
// mensuelles ~13 pts resteraient lacunaires). Garder 35 pour une vraie
// densification journalière.

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { runHistoryBackfill } from "@/lib/ingestion/run-history-backfill";
import { parseHistoryBackfillSearchParams } from "@/lib/ingestion/history-backfill-query";
import { sendIngestionAlert } from "@/lib/ingestion/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  const parsed = parseHistoryBackfillSearchParams(request.nextUrl.searchParams);

  try {
    const summary = await runHistoryBackfill(parsed);
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendIngestionAlert({
      severity: "critical",
      title: "Échec du backfill historique",
      message,
    });
    return NextResponse.json({ ok: false, error: "Échec du backfill", details: message }, { status: 500 });
  }
}
