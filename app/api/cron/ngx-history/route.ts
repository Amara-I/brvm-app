// GET /api/cron/ngx-history — backfill NGX borné, reprisable.
// Volontairement ABSENT de vercel.json : le plan Hobby n'a qu'un créneau
// cron (ingest quotidien). À enchaîner à la main ou par un scheduler externe.
//
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "https://<host>/api/cron/ngx-history?date=2026-10-27&budgetMs=240000"
//
// Query :
//   from=YYYY-MM-DD     début (défaut : aujourd'hui − 5 ans)
//   to=YYYY-MM-DD       fin (défaut : aujourd'hui UTC)
//   date=2026-10-27     une séance (aussi 27/10 ou 27/10/2026).
//                       Active charts + fx, et le JSON du jour si la date colle.
//   cursor=YYYY-MM-DD   reprise : le `next` de la réponse précédente
//   limit=20            séances traitées par appel (défaut 20, max 60, 0 = aucun PDF).
//                       Le budget arrête la boucle avant le plafond de temps.
//   budgetMs=240000     plafond, jamais au-dessus de 240000
//   charts=1|0          chart_series NGX (sociétés + indices). Défaut : 1 si date=, sinon 0
//   fx=1|0              dernier EUR→NGN dans fx_rates. Défaut : 1 si date=, sinon 0
//   indices=0           saute la page de couverture
//   after=DANGCEM       reprise du refresh chart_series
//   resume=0            ignore le curseur mémorisé (les clôtures déjà là restent sautées)
//
// Réponse : data.incomplete, data.next / data.cursor, data.chartsNext,
// data.skippedUnknown (tickers du PDF absents de la base NGX : ignorés,
// l'historique n'écrit que des cours, il ne crée ni ne renomme de société).
// Répéter en passant cursor=next jusqu'à incomplete=false.
// Les 404 (fériés) sont mémorisés dans ingestion_logs. Une séance avec
// ≥ 80 clôtures canoniques NGX n'est pas retéléchargée.
// Délai doclib : 2 s (lib/ingestion/http-client.ts). Pas de PDF en base.
//
// POST = GET.

import { NextRequest, NextResponse } from "next/server";
import { sendIngestionAlert } from "@/lib/ingestion/alerts";
import { getConnectorFeatureFlags } from "@/lib/ingestion/connector-config";
import { parseNgxHistorySearchParams } from "@/lib/ingestion/ngx-history-query";
import { runNgxHistoryBackfill } from "@/lib/ingestion/run-ngx-history";
import { isCronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  if (!getConnectorFeatureFlags().ngx) {
    return NextResponse.json({
      ok: true,
      data: { skipped: true, reason: "INGESTION_ENABLE_NGX=false", incomplete: false },
    });
  }

  const parsed = parseNgxHistorySearchParams(request.nextUrl.searchParams);

  try {
    const summary = await runNgxHistoryBackfill({
      from: parsed.from,
      to: parsed.to,
      cursor: parsed.cursor,
      limit: parsed.limit,
      budgetMs: parsed.budgetMs,
      indices: parsed.indices,
      charts: parsed.charts,
      chartsAfter: parsed.chartsAfter,
      fx: parsed.fx,
      tryJson: parsed.tryJson,
      resume: parsed.resume,
    });
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendIngestionAlert({
      severity: "critical",
      title: "NGX — échec du backfill historique",
      message,
    });
    return NextResponse.json({ ok: false, error: "Échec du backfill NGX", details: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
