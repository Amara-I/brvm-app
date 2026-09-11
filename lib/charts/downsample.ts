import type { ChartClosePoint } from "./indicators";

/**
 * Largest-Triangle-Three-Buckets (LTTB) — réduit une série dense tout en
 * conservant la forme (premier / dernier + pics visuels).
 * Utile pour Recharts (fiche société) quand MAX contient des milliers de jours.
 */
export function downsampleLttb(points: ChartClosePoint[], maxPoints: number): ChartClosePoint[] {
  if (maxPoints < 3 || points.length <= maxPoints) return points;

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const bucketCount = maxPoints - 2;
  const bucketSize = (points.length - 2) / bucketCount;
  const out: ChartClosePoint[] = [first];

  let prevIndex = 0;
  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = Math.floor(i * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, points.length - 1);

    const nextStart = Math.floor((i + 1) * bucketSize) + 1;
    const nextEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, points.length - 1);
    let avgX = 0;
    let avgY = 0;
    const nextCount = Math.max(1, nextEnd - nextStart);
    for (let j = nextStart; j < nextEnd; j++) {
      avgX += j;
      avgY += points[j]!.value;
    }
    if (i === bucketCount - 1) {
      avgX = points.length - 1;
      avgY = last.value;
    } else {
      avgX /= nextCount;
      avgY /= nextCount;
    }

    const prev = points[prevIndex]!;
    let bestIndex = bucketStart;
    let bestArea = -1;
    for (let j = bucketStart; j < bucketEnd; j++) {
      const p = points[j]!;
      const area = Math.abs((prevIndex - avgX) * (p.value - prev.value) - (prevIndex - j) * (avgY - prev.value));
      if (area > bestArea) {
        bestArea = area;
        bestIndex = j;
      }
    }
    out.push(points[bestIndex]!);
    prevIndex = bestIndex;
  }

  out.push(last);
  return out;
}
