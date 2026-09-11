// GET /api/cron/history-backfill — rattrapage historique Sika (cron-safe).
// Non listé dans vercel.json (quota Hobby = 2 crons : ingest + research).
// Déclenchement manuel / scheduler externe :
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "https://<host>/api/cron/history-backfill?budgetMs=240000"
// Query : tickers=SNTS,SGBC · dailyFrom=2015-01-01|auto|off · maxTickers=5
//         after=SNTS · noSheets=1 · noDaily=1

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { runHistoryBackfill } from "@/lib/ingestion/run-history-backfill";
import { sendIngestionAlert } from "@/lib/ingestion/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams;
  const tickers = q.get("tickers")?.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
  const dailyFromRaw = q.get("dailyFrom") ?? "auto";
  const dailyFrom =
    dailyFromRaw === "off" || dailyFromRaw === "false"
      ? "off"
      : /^\d{4}-\d{2}-\d{2}$/.test(dailyFromRaw)
        ? dailyFromRaw
        : "auto";
  const budgetMs = Number(q.get("budgetMs") ?? "240000");
  const maxTickers = q.get("maxTickers") ? Number(q.get("maxTickers")) : undefined;

  try {
    const summary = await runHistoryBackfill({
      tickers: tickers?.length ? tickers : undefined,
      dailyFrom,
      includeDaily: dailyFrom !== "off" && q.get("noDaily") !== "1",
      includeSheets: q.get("noSheets") !== "1",
      includeEventsNews: q.get("noEvents") !== "1",
      includeDocuments: q.get("noDocs") !== "1",
      timeBudgetMs: Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : 240_000,
      maxTickers: maxTickers != null && Number.isFinite(maxTickers) ? maxTickers : undefined,
      resume: q.get("noResume") !== "1",
      resumeAfterTicker: q.get("after")?.toUpperCase() || undefined,
    });
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
