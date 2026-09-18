// GET /api/cron/refresh-documents — catalogue documents BRVM (via OuestBourse).
// Non listé dans vercel.json (quota Hobby = 2 crons : ingest + research).
// Déclenchement manuel / scheduler externe :
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     "https://<host>/api/cron/refresh-documents?budgetMs=240000"
//
// Query :
//   tickers=SNTS,SGBC
//   maxTickers=8
//   after=SNTS            reprend APRÈS ce ticker
//   noResume=1
//   noFundamentals=1      saute screener + comptes annuels extraits
//   budgetMs=240000
//
// Source : `brvm_documents` + `brvm_financials_annual` (PDF brvm.org indexés).
// CLI local : npm run docs:refresh

import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import {
  parseDocumentRefreshSearchParams,
  runDocumentRefresh,
} from "@/lib/ingestion/run-document-refresh";
import { sendIngestionAlert } from "@/lib/ingestion/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  const parsed = parseDocumentRefreshSearchParams(request.nextUrl.searchParams);

  try {
    const summary = await runDocumentRefresh({
      ...parsed,
      logger: (msg) => console.log(`[cron→docs] ${msg}`),
    });
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendIngestionAlert({
      severity: "critical",
      title: "Échec de l'actualisation des documents",
      message,
    });
    return NextResponse.json(
      { ok: false, error: "Échec de l'actualisation des documents", details: message },
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
