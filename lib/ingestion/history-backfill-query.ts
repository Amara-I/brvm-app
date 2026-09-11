// Parse les query params / flags CLI du backfill historique (pur, testable).
//
// forceDaily=1 : ignore INGESTION_ENABLE_SIKA_DAILY_HISTORY=false et planifie
// les fenêtres lacunaires. Ne baisse PAS le seuil de densité à 1 par défaut
// (minPoints=1 ne refetch que les chunks vides et sauterait les années
// mensuelles, ex. BICC 2023–2026). Passer minDailyPoints pour override.
// Un GetHistos réussi sans nouvel upsert sature la fenêtre même sous 35 pts.

import type { HistoryBackfillOptions } from "./run-history-backfill";
import {
  DEFAULT_MIN_DAILY_POINTS_PER_CHUNK,
  parseIsoDateFlag,
} from "./history-coverage";

export interface ParsedHistoryBackfillQuery extends HistoryBackfillOptions {
  forceDaily: boolean;
  minDailyPoints: number;
}

function truthyParam(raw: string | null): boolean {
  if (raw == null) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function parseHistoryBackfillSearchParams(
  q: URLSearchParams
): ParsedHistoryBackfillQuery {
  const tickers = q
    .get("tickers")
    ?.split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  const dailyFromRaw = q.get("dailyFrom") ?? "auto";
  const dailyFrom =
    dailyFromRaw === "off" || dailyFromRaw === "false"
      ? "off"
      : parseIsoDateFlag(dailyFromRaw) ?? "auto";
  const budgetMs = Number(q.get("budgetMs") ?? "240000");
  const maxTickers = q.get("maxTickers") ? Number(q.get("maxTickers")) : undefined;
  const maxDailyChunks = q.get("maxDailyChunks") ? Number(q.get("maxDailyChunks")) : undefined;
  const minDailyRaw = q.get("minDailyPoints");
  const minDailyPoints = minDailyRaw ? Number(minDailyRaw) : DEFAULT_MIN_DAILY_POINTS_PER_CHUNK;
  const forceDaily = truthyParam(q.get("forceDaily"));

  return {
    tickers: tickers?.length ? tickers : undefined,
    dailyFrom,
    forceDaily,
    minDailyPoints: Number.isFinite(minDailyPoints) && minDailyPoints >= 1 ? minDailyPoints : DEFAULT_MIN_DAILY_POINTS_PER_CHUNK,
    includeDaily: forceDaily || (dailyFrom !== "off" && q.get("noDaily") !== "1"),
    includeSheets: q.get("noSheets") !== "1",
    includeEventsNews: q.get("noEvents") !== "1",
    includeDocuments: q.get("noDocs") !== "1",
    timeBudgetMs: Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : 240_000,
    maxTickers: maxTickers != null && Number.isFinite(maxTickers) ? maxTickers : undefined,
    maxDailyChunks:
      maxDailyChunks != null && Number.isFinite(maxDailyChunks) ? Math.floor(maxDailyChunks) : undefined,
    resume: q.get("noResume") !== "1",
    resumeAfterTicker: q.get("after")?.toUpperCase() || undefined,
    resumeInclusive: false,
  };
}
