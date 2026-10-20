// Budget de temps du cron d'ingestion.
//
// Vercel Hobby tue la fonction à `maxDuration` (300s observé en prod :
// « Task timed out after 300 seconds ») sans exécuter le `catch` de la route.
// Le budget interne laisse de la marge pour persister et répondre.
//
// Le bug corrigé : après les connecteurs, chaque étape optionnelle recalculait
// `Math.max(plancher, 270_000 - elapsedFigé)`. L'elapsed était figé AVANT
// ces étapes, et les planchers se cumulaient (indices + historique + charts)
// au-delà du temps réellement restant.

export const DEFAULT_VERCEL_INGEST_BUDGET_MS = 240_000;
export const DEFAULT_CLI_INGEST_BUDGET_MS = 15 * 60_000;
export const INGEST_SAFETY_MS = 12_000;

/// Coût prudent d'une fiche Richbourse (Crawl-delay 3s + aller-retour).
export const RICHBOURSE_MS_PER_TICKER = 4_000;
export const RICHBOURSE_CAP_BRVM_OK_MS = 36_000;
export const RICHBOURSE_CAP_BRVM_MISSING_MS = 90_000;
export const RICHBOURSE_CAP_BOTH_MISSING_MS = 140_000;

export interface TimeBudget {
  totalMs: number;
  startedAtMs: number;
  deadlineMs: number;
  elapsedMs: () => number;
  remainingMs: () => number;
  expired: () => boolean;
  canStart: (minMs: number) => boolean;
}

export function createTimeBudget(totalMs: number, now: () => number = Date.now): TimeBudget {
  const startedAtMs = now();
  const deadlineMs = startedAtMs + totalMs;
  return {
    totalMs,
    startedAtMs,
    deadlineMs,
    elapsedMs: () => now() - startedAtMs,
    remainingMs: () => deadlineMs - now(),
    expired: () => now() >= deadlineMs,
    canStart: (minMs: number) => deadlineMs - now() >= minMs,
  };
}

export interface IngestStepLog {
  name: string;
  durationMs: number;
  skipped: boolean;
  reason?: string;
}

export function resolveIngestBudgetMs(
  explicit?: number,
  env: Record<string, string | undefined> = process.env
): number {
  if (explicit != null && Number.isFinite(explicit)) return Math.max(5_000, Math.floor(explicit));
  const fromEnv = Number(env.INGESTION_CRON_BUDGET_MS);
  if (env.INGESTION_CRON_BUDGET_MS != null && env.INGESTION_CRON_BUDGET_MS !== "" && Number.isFinite(fromEnv) && fromEnv >= 5_000) {
    return Math.floor(fromEnv);
  }
  if (env.VERCEL) return DEFAULT_VERCEL_INGEST_BUDGET_MS;
  return DEFAULT_CLI_INGEST_BUDGET_MS;
}

/// CLI / budget long : on a le temps de croiser toutes les fiches Richbourse.
export function preferCompleteTertiary(budgetMs: number): boolean {
  return budgetMs >= 10 * 60_000;
}

export function richbourseWantMs(input: {
  tickerCount: number;
  brvmQuotesOk: boolean;
  sikaQuotesOk: boolean;
  preferComplete: boolean;
}): number {
  const all = Math.max(0, input.tickerCount) * RICHBOURSE_MS_PER_TICKER;
  if (input.preferComplete) return all;
  if (!input.brvmQuotesOk && !input.sikaQuotesOk) return Math.min(all, RICHBOURSE_CAP_BOTH_MISSING_MS);
  if (!input.brvmQuotesOk) return Math.min(all, RICHBOURSE_CAP_BRVM_MISSING_MS);
  return Math.min(all, RICHBOURSE_CAP_BRVM_OK_MS);
}

export interface StepAllocation {
  run: boolean;
  budgetMs: number;
  reason?: string;
}

export interface OptionalIngestPlan {
  richbourseQuotes: StepAllocation;
  indexEnrichment: StepAllocation;
  historyBackfill: StepAllocation;
  documents: StepAllocation;
  chartSeries: StepAllocation;
  alerts: StepAllocation;
  safetyMs: number;
}

export function planOptionalIngestSteps(input: {
  remainingMs: number;
  richbourseQuotesEnabled: boolean;
  richbourseWantMs: number;
  historyOnDailyCron: boolean;
  documentsOnDailyCron: boolean;
  indexOnDailyCron: boolean;
}): OptionalIngestPlan {
  let left = Math.max(0, input.remainingMs - INGEST_SAFETY_MS);

  const take = (enabled: boolean, wantMs: number, minMs: number, disabledReason: string): StepAllocation => {
    if (!enabled) return { run: false, budgetMs: 0, reason: disabledReason };
    if (wantMs <= 0) return { run: false, budgetMs: 0, reason: "rien à faire" };
    if (left < minMs) {
      return { run: false, budgetMs: 0, reason: `reste utile ${left}ms < ${minMs}ms` };
    }
    const budgetMs = Math.min(wantMs, left);
    left -= budgetMs;
    return { run: true, budgetMs };
  };

  return {
    richbourseQuotes: take(
      input.richbourseQuotesEnabled,
      input.richbourseWantMs,
      12_000,
      "cotations Richbourse désactivées"
    ),
    indexEnrichment: take(input.indexOnDailyCron, 30_000, 12_000, "enrichissement d'indices désactivé"),
    historyBackfill: take(input.historyOnDailyCron, 40_000, 15_000, "backfill hors cron quotidien"),
    documents: take(input.documentsOnDailyCron, 24_000, 12_000, "documents hors cron quotidien"),
    chartSeries: take(true, 20_000, 8_000, ""),
    alerts: take(true, 12_000, 4_000, ""),
    safetyMs: INGEST_SAFETY_MS,
  };
}

export function allocatedOptionalMs(plan: OptionalIngestPlan): number {
  return (
    plan.richbourseQuotes.budgetMs +
    plan.indexEnrichment.budgetMs +
    plan.historyBackfill.budgetMs +
    plan.documents.budgetMs +
    plan.chartSeries.budgetMs +
    plan.alerts.budgetMs
  );
}

export function utcEpochDay(nowMs: number): number {
  return Math.floor(nowMs / 86_400_000);
}

/// Fenêtre glissante : chaque jour avance de `maxCount` tickers (tri stable).
/// Le cron Hobby ne tourne qu'une fois par jour — la couverture tertiaire
/// se complète sur plusieurs séances, sans jamais inventer de cours.
export function sliceTickersForRun(
  tickers: readonly string[],
  epochDay: number,
  maxCount: number
): { selected: string[]; deferred: string[] } {
  const sorted = [...new Set(tickers.map((t) => t.toUpperCase()))].sort();
  if (sorted.length === 0 || maxCount <= 0) return { selected: [], deferred: sorted };
  if (maxCount >= sorted.length) return { selected: sorted, deferred: [] };
  const start = (((epochDay * maxCount) % sorted.length) + sorted.length) % sorted.length;
  const rotated = [...sorted.slice(start), ...sorted.slice(0, start)];
  return { selected: rotated.slice(0, maxCount), deferred: rotated.slice(maxCount) };
}

export async function forEachUntilBudget<T>(
  items: readonly T[],
  budget: TimeBudget,
  minRemainingMs: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<{ processed: number; deferred: number; stoppedEarly: boolean }> {
  let processed = 0;
  for (let i = 0; i < items.length; i++) {
    if (!budget.canStart(minRemainingMs)) {
      return { processed, deferred: items.length - processed, stoppedEarly: true };
    }
    await fn(items[i]!, i);
    processed++;
  }
  return { processed, deferred: 0, stoppedEarly: false };
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (!(ms > 0)) return Promise.reject(new Error(`${label} : délai épuisé`));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} : délai ${ms}ms dépassé`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
