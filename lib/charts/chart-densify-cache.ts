/**
 * Cache mémoire + timeout pour la densification multi-source des graphes.
 * Évite de rappeler Sika/Rich/OuestBourse à chaque ouverture de ticker.
 */

import type { ChartClosePoint } from "@/lib/charts/indicators";

export type DensifiedChartPayload = {
  series: ChartClosePoint[];
  discrepanciesCount: number;
  densifySources: string[];
  fromCache: boolean;
  timedOut: boolean;
};

type CacheEntry = {
  at: number;
  /** Empreinte de la série DB au moment du calcul. */
  fingerprint: string;
  series: ChartClosePoint[];
  discrepanciesCount: number;
  densifySources: string[];
};

const cache = new Map<string, CacheEntry>();

/** TTL cache densification (ms) — 30 min. */
export const CHART_DENSIFY_CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Au-delà de ce délai, on sert la série DB immédiatement
 * (densification live trop lente pour l'UX).
 */
export const CHART_DENSIFY_TIMEOUT_MS = Number(
  process.env.CHART_DENSIFY_TIMEOUT_MS ?? 4500
);

export function chartDbFingerprint(
  points: Array<{ time: string; value: number }>
): string {
  if (points.length === 0) return "empty";
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${points.length}:${first.time}:${last.time}:${last.value}`;
}

export function getCachedDensifiedSeries(
  ticker: string,
  fingerprint: string
): DensifiedChartPayload | null {
  const key = ticker.toUpperCase();
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CHART_DENSIFY_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  if (hit.fingerprint !== fingerprint) {
    return null;
  }
  return {
    series: hit.series,
    discrepanciesCount: hit.discrepanciesCount,
    densifySources: hit.densifySources,
    fromCache: true,
    timedOut: false,
  };
}

/** Dernière densification connue pour ce ticker (même si la DB a un jour de plus). */
export function getAnyCachedDensifiedSeries(ticker: string): DensifiedChartPayload | null {
  const key = ticker.toUpperCase();
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CHART_DENSIFY_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return {
    series: hit.series,
    discrepanciesCount: hit.discrepanciesCount,
    densifySources: hit.densifySources,
    fromCache: true,
    timedOut: false,
  };
}

export function setCachedDensifiedSeries(
  ticker: string,
  fingerprint: string,
  series: ChartClosePoint[],
  discrepanciesCount: number,
  densifySources: string[]
): void {
  cache.set(ticker.toUpperCase(), {
    at: Date.now(),
    fingerprint,
    series,
    discrepanciesCount,
    densifySources,
  });
}

export function shouldSkipLiveDensify(): boolean {
  const v = process.env.CHARTS_SKIP_LIVE_DENSIFY?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<{ ok: true; value: T } | { ok: false; timedOut: true }> {
  if (!Number.isFinite(ms) || ms <= 0) {
    return { ok: true, value: await promise };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      promise.then((value) => ({ ok: true as const, value })),
      new Promise<{ ok: false; timedOut: true }>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, timedOut: true }), ms);
      }),
    ]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
