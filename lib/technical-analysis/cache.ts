// Cache mémoire par empreinte de série. Aucune écriture base.
// Réutilisé par les pages et les alertes du même processus Node.

import { analyzePriceHistory } from "./analyze";
import type { CloseInput, TechnicalAnalysis } from "./types";

const MAX = 256;
const cache = new Map<string, TechnicalAnalysis>();

export function seriesFingerprint(points: CloseInput[]): string {
  const n = points.length;
  if (n === 0) return "0";
  const a = points[0]!;
  const b = points[n - 1]!;
  const m = points[n >> 1]!;
  return `${n}|${a.time}|${a.value}|${m.time}|${m.value}|${b.time}|${b.value}|${b.volume ?? ""}`;
}

export function analyzePriceHistoryCached(points: CloseInput[]): TechnicalAnalysis {
  const key = seriesFingerprint(points);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const value = analyzePriceHistory(points ?? []);
  cache.set(key, value);
  if (cache.size > MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return value;
}

/** Tests uniquement. */
export function clearTechnicalAnalysisCache(): void {
  cache.clear();
}
