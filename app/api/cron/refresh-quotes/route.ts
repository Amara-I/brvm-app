// ═══════════════════════════════════════════════════════════════════════════
// GET /api/cron/refresh-quotes — Actualisation intrajournalière des cours
// ═══════════════════════════════════════════════════════════════════════════
// Variante légère du cron multi-source (`/api/cron/ingest`) : derniers cours
// seulement (upsert de la séance du jour), sans fondamentaux ni reconstruction
// des graphes. Protégée par CRON_SECRET (en-tête `Authorization: Bearer …` ou
// `?secret=`). NON programmée : le plan Hobby n'autorise que des crons
// quotidiens (vercel.json inchangé) ; un ordonnanceur externe peut l'appeler.
//
// Paramètres :
//   - `market=BRVM` (défaut, comportement historique) | `NGX` | `ALL` ;
//   - `alerts=0` : ne pas évaluer les alertes à chaque passage (défaut : évaluées) ;
//   - `force=1` : tirer même hors séance (sinon, hors séance et le week-end,
//     la place est ignorée sans requête vers la source).
// Chaque écriture invalide le cache des derniers cours (fiches, listes, sondage live).
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { revalidateMarketDataCache } from "@/lib/api/revalidate-market-cache";
import { revalidateQuotesAfterWrite } from "@/lib/cache/revalidate-quotes";
import { runBrvmQuotesRefresh, type BrvmQuotesRefreshSummary } from "@/lib/ingestion/run-brvm-quotes-refresh";
import { runNgxDailyIngest, type NgxIngestSummary } from "@/lib/ingestion/run-ngx-ingest";
import { sendIngestionAlert } from "@/lib/ingestion/alerts";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { intradayMarkets, intradayWindowOpen } from "@/lib/quotes/market-hours";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const NGX_BUDGET_MS = 40_000;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const markets = intradayMarkets(params.get("market"));
  const force = params.get("force") === "1";
  const evaluateAlerts = params.get("alerts") !== "0";
  const now = new Date();

  const data: {
    brvm?: BrvmQuotesRefreshSummary | { skipped: true; skipReason: string };
    ngx?: NgxIngestSummary | { skipped: true; skipReason: string };
  } = {};

  try {
    if (markets.includes("BRVM")) {
      if (!force && !intradayWindowOpen("BRVM", now)) {
        data.brvm = { skipped: true, skipReason: "BRVM fermée (hors séance)" };
      } else {
        const summary = await runBrvmQuotesRefresh({ skipFundamentals: true, evaluateAlerts });
        if (!summary.skipped && summary.reconciledPricesCount > 0) {
          revalidateMarketDataCache();
          revalidateQuotesAfterWrite({ markets: ["BRVM"] });
        }
        if (!summary.skipped && summary.errors.length > 0) {
          await sendIngestionAlert({
            severity: "warning",
            title: "Actualisation intrajournalière BRVM partielle",
            message: `${summary.quotesFetched} cours · ${summary.errors.join(" ; ")}`,
          });
        }
        data.brvm = summary;
      }
    }

    if (markets.includes("NGX")) {
      if (!force && !intradayWindowOpen("NGX", now)) {
        data.ngx = { skipped: true, skipReason: "NGX fermée (hors séance)" };
      } else {
        // Cours + indices du jour seulement : pas de reconstruction des graphes
        // (relue à la lecture, cf. lib/charts/overlay-latest-close.ts).
        const summary = await runNgxDailyIngest({ budgetMs: NGX_BUDGET_MS, refreshCharts: false });
        revalidateQuotesAfterWrite({ markets: ["NGX"] });
        if (evaluateAlerts && summary.status !== "FAILED" && summary.quotes > 0) {
          try {
            const { evaluateAllAlerts } = await import("@/lib/notifications/evaluate-all");
            await evaluateAllAlerts({ exchanges: ["NGX"], skipEmailFlush: true });
          } catch (err) {
            console.error("[refresh-quotes] alertes NGX ignorées :", err instanceof Error ? err.message : err);
          }
        }
        data.ngx = summary;
      }
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendIngestionAlert({
      severity: "critical",
      title: "Échec de l'actualisation intrajournalière des cours",
      message,
    });
    return NextResponse.json(
      { ok: false, error: "Échec de l'actualisation des cours", details: message },
      { status: 500 }
    );
  }
}
