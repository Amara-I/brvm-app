// POST /api/companies/:ticker/refresh-documents
// Bouton « Actualiser » de l'onglet Documents (fiche société).
// Tire le catalogue BRVM via OuestBourse pour CE ticker uniquement
// (PDF réels, jamais inventés) + comptes annuels extraits.
// Cooldown 10 min / IP / ticker.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanySheetPayload } from "@/lib/api/company-sheet-dataset";
import { apiError, apiNotFound, apiSuccess, privateCacheHeaders } from "@/lib/api/response";
import { runDocumentRefresh } from "@/lib/ingestion/run-document-refresh";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COOLDOWN_MS = 10 * 60_000;
const COOLDOWN_LIMIT = 1;

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  const exists = await prisma.company.findUnique({
    where: { ticker },
    select: { id: true },
  });
  if (!exists) return apiNotFound(`Société "${ticker}"`);

  const ip = clientIp(request);
  const cooldown = checkRateLimit(`refresh-docs:${ip}:${ticker}`, {
    limit: COOLDOWN_LIMIT,
    windowMs: COOLDOWN_MS,
  });

  try {
    const ingestion = cooldown.allowed
      ? await runDocumentRefresh({
          tickers: [ticker],
          maxTickers: 1,
          resume: false,
          timeBudgetMs: 45_000,
          logger: (msg) => console.log(`[sheet→docs ${ticker}] ${msg}`),
        })
      : {
          skipped: true,
          skipReason:
            "Actualisation récente — documents rechargés depuis la base (prochain tirage dans quelques minutes).",
          source: "OUESTBOURSE" as const,
          documentsUpserted: 0,
          resultsDocuments: 0,
          fundamentalsUpserted: 0,
          tickersAttempted: 0,
          tickersOk: 0,
          incomplete: false,
          nextTicker: null,
          durationMs: 0,
        };

    const payload = await getCompanySheetPayload(ticker);
    if (!payload) return apiNotFound(`Société "${ticker}"`);

    return apiSuccess(
      {
        documents: payload.documents,
        incomeStatement: payload.incomeStatement,
        keyRows: payload.keyRows,
        ingestion,
      },
      { headers: privateCacheHeaders() }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("Échec de l'actualisation des documents", 500, message);
  }
}
