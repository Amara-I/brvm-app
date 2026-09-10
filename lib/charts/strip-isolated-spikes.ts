import type { ChartClosePoint } from "./indicators";

/**
 * Retire les pics / creux isolés (1 point) qui écrasent l'échelle du graphe.
 * Critère : le point s'écarte de > `spikePct` de ses deux voisins, alors que
 * les voisins restent proches l'un de l'autre (< `neighborPct`).
 */
export function stripIsolatedPriceSpikes(
  points: ChartClosePoint[],
  options?: { spikePct?: number; neighborPct?: number }
): ChartClosePoint[] {
  if (points.length < 3) return points;
  const spikePct = options?.spikePct ?? 15;
  const neighborPct = options?.neighborPct ?? 12;

  const keep = points.map(() => true);
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!.value;
    const cur = points[i]!.value;
    const next = points[i + 1]!.value;
    if (prev <= 0 || cur <= 0 || next <= 0) continue;

    const vsPrev = (Math.abs(cur - prev) / prev) * 100;
    const vsNext = (Math.abs(cur - next) / next) * 100;
    const neighbors = (Math.abs(next - prev) / Math.min(prev, next)) * 100;

    if (vsPrev >= spikePct && vsNext >= spikePct && neighbors <= neighborPct) {
      keep[i] = false;
    }
  }

  return points.filter((_, i) => keep[i]);
}
