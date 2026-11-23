// GET /api/cron/refresh-news — actualités par société (Sikafinance). Non listé dans vercel.json
// (plan Hobby) : déclenché par .github/workflows/news.yml.
//   curl -H "Authorization: Bearer $CRON_SECRET" "https://<host>/api/cron/refresh-news?after=SNTS"
// Query : tickers=SNTS,SGBC · after=SNTS · maxTickers=12 · budgetMs=240000

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { parseNewsRefreshSearchParams, runNewsRefresh } from "@/lib/ingestion/run-news-refresh";
import { sendIngestionAlert } from "@/lib/ingestion/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }
  try {
    const summary = await runNewsRefresh({
      ...parseNewsRefreshSearchParams(request.nextUrl.searchParams),
      logger: (msg) => console.log(`[cron→news] ${msg}`),
    });
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendIngestionAlert({ severity: "warning", title: "Échec de la collecte d'actualités", message });
    return NextResponse.json(
      { ok: false, error: "Échec de la collecte d'actualités", details: message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
