// POST /api/market/refresh-ngx-quotes — Tire les cours NGX du jour (JSON
// officiel, repli PDF) puis renvoie la vue d'ensemble à jour.
// Branché sur le bouton « Actualiser les cours » de /marches/ngx.
// Même cooldown que la BRVM : 1 appel / 10 min / IP. Hors cooldown, on
// recharge depuis la base sans nouvel appel réseau.

import { NextRequest } from "next/server";
import { apiError, apiSuccess, privateCacheHeaders } from "@/lib/api/response";
import { getI18n } from "@/lib/i18n/get-i18n";
import { getConnectorFeatureFlags } from "@/lib/ingestion/connector-config";
import { runNgxDailyIngest } from "@/lib/ingestion/run-ngx-ingest";
import { loadNgxOverviewBoard } from "@/lib/markets/load-ngx-overview-board";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Ingestion NGX (JSON + éventuellement PDF) + reconstruction du tableau.
// Plafond sous les 300 s de la plateforme Hobby.
export const maxDuration = 180;

const COOLDOWN_MS = 10 * 60_000;
const COOLDOWN_LIMIT = 1;
const INGEST_BUDGET_MS = 90_000;

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const cooldown = checkRateLimit(`refresh-ngx-quotes:${ip}`, {
    limit: COOLDOWN_LIMIT,
    windowMs: COOLDOWN_MS,
  });
  const { t } = getI18n();

  try {
    if (!cooldown.allowed) {
      const board = await loadNgxOverviewBoard(t);
      return apiSuccess(
        {
          ...board,
          ingestion: {
            skipped: true,
            skipReason:
              "Actualisation récente — données rechargées depuis la base (prochain tirage NGX dans quelques minutes).",
            status: "SUCCESS",
            quotes: 0,
            indices: 0,
            errors: [] as string[],
          },
        },
        { headers: privateCacheHeaders() }
      );
    }

    if (!getConnectorFeatureFlags().ngx) {
      const board = await loadNgxOverviewBoard(t);
      return apiSuccess(
        {
          ...board,
          ingestion: {
            skipped: true,
            skipReason: "Ingestion NGX désactivée — données rechargées depuis la base.",
            status: "SUCCESS",
            quotes: 0,
            indices: 0,
            errors: [] as string[],
          },
        },
        { headers: privateCacheHeaders() }
      );
    }

    const ingestion = await runNgxDailyIngest({ budgetMs: INGEST_BUDGET_MS });
    const board = await loadNgxOverviewBoard(t);
    return apiSuccess(
      {
        ...board,
        ingestion: {
          skipped: false,
          status: ingestion.status,
          quotes: ingestion.quotes,
          indices: ingestion.indices,
          errors: ingestion.errors,
        },
      },
      { headers: privateCacheHeaders() }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      const board = await loadNgxOverviewBoard(t);
      return apiSuccess(
        {
          ...board,
          ingestion: {
            skipped: false,
            status: "FAILED",
            quotes: 0,
            indices: 0,
            errors: [message],
          },
        },
        { headers: privateCacheHeaders() }
      );
    } catch {
      return apiError("Échec de l'actualisation des cours NGX", 500, message);
    }
  }
}
