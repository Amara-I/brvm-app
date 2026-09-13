// GET|POST /api/cron/evaluate-alerts — évalue les règles contre les cours en base.
// Protégé par CRON_SECRET. Non listé dans vercel.json (quota Hobby = 2 crons) :
// appelé après l'ingestion / le refresh-quotes, ou manuellement.

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { evaluateAllAlerts } from "@/lib/notifications/evaluate-all";
import { isDatabaseUnavailable, isMissingDatabaseObject } from "@/lib/db/is-database-unavailable";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  try {
    const tickers = request.nextUrl.searchParams.get("tickers");
    const summary = await evaluateAllAlerts({
      tickers: tickers
        ? tickers
            .split(",")
            .map((t) => t.trim().toUpperCase())
            .filter(Boolean)
        : undefined,
    });
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingDatabaseObject(err)) {
      return NextResponse.json({ ok: false, error: "Base de données indisponible" }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: "Échec de l'évaluation des alertes", details: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
