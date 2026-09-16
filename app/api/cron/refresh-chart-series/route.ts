// GET /api/cron/refresh-chart-series — rebuild borné des séries précalculées.
// Non listé dans vercel.json (quota Hobby = 2 crons). Appelé après /api/cron/ingest
// et manuellement :
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "https://<host>/api/cron/refresh-chart-series?budgetMs=45000"

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { refreshChartSeries } from "@/lib/charts/refresh-chart-series";
import { sendIngestionAlert } from "@/lib/ingestion/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams;
  const budgetMs = Number(q.get("budgetMs") ?? "45000");
  const symbols = q
    .get("symbols")
    ?.split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const kindsRaw = q.get("kinds");
  const kinds = kindsRaw
    ? kindsRaw
        .split(",")
        .map((k) => k.trim().toUpperCase())
        .filter((k): k is "COMPANY" | "INDEX" => k === "COMPANY" || k === "INDEX")
    : undefined;

  try {
    const summary = await refreshChartSeries({
      symbols: symbols?.length ? symbols : undefined,
      kinds,
      timeBudgetMs: Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : 45_000,
    });
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendIngestionAlert({
      severity: "critical",
      title: "Échec du refresh chart_series",
      message,
    });
    return NextResponse.json({ ok: false, error: "Échec du refresh chart_series", details: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
