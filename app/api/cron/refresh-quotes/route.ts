// ═══════════════════════════════════════════════════════════════════════════
// GET /api/cron/refresh-quotes — Actualisation horaire des cours BRVM
// ═══════════════════════════════════════════════════════════════════════════
// Variante légère du cron multi-source (`/api/cron/ingest`) : tire uniquement
// les cotations BRVM.org (source de vérité) pour toutes les sociétés actives.
// Programmé toutes les heures via vercel.json + scheduler local en dev.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { revalidateMarketDataCache } from "@/lib/api/revalidate-market-cache";
import { runBrvmQuotesRefresh } from "@/lib/ingestion/run-brvm-quotes-refresh";
import { sendIngestionAlert } from "@/lib/ingestion/alerts";
import { isCronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
  }

  try {
    const summary = await runBrvmQuotesRefresh({ skipFundamentals: true });
    if (!summary.skipped && summary.reconciledPricesCount > 0) {
      revalidateMarketDataCache();
    }
    if (!summary.skipped && summary.errors.length > 0) {
      await sendIngestionAlert({
        severity: "warning",
        title: "Actualisation horaire BRVM partielle",
        message: `${summary.quotesFetched} cours · ${summary.errors.join(" ; ")}`,
      });
    }
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendIngestionAlert({
      severity: "critical",
      title: "Échec de l'actualisation horaire des cours",
      message,
    });
    return NextResponse.json(
      { ok: false, error: "Échec de l'actualisation des cours", details: message },
      { status: 500 }
    );
  }
}
