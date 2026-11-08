// Fair Value Gaps (trio de bougies) : haussier si le bas de la 3e est au-dessus
// du haut de la 1re ; baissier dans l'autre sens. Comblé / partiel / ouvert.

import { roundPrice } from "./bars";
import type { FairValueGap, GapStatus, PriceBar } from "./types";

function overlapRatio(aLow: number, aHigh: number, bLow: number, bHigh: number): number {
  const inter = Math.min(aHigh, bHigh) - Math.max(aLow, bLow);
  if (!(inter > 0)) return 0;
  const span = Math.max(aHigh - aLow, bHigh - bLow, 0.0001);
  return inter / span;
}

export function detectFairValueGaps(bars: PriceBar[], atr: number | null): FairValueGap[] {
  if (bars.length < 3) return [];
  const found: FairValueGap[] = [];
  for (let i = 1; i < bars.length - 1; i++) {
    const prev = bars[i - 1]!;
    const mid = bars[i]!;
    const next = bars[i + 1]!;
    const ref = Math.max(mid.close, 1);
    const minGap = Math.max((atr ?? ref * 0.01) * 0.25, ref * 0.004);
    let side: FairValueGap["side"] | null = null;
    let low = 0;
    let high = 0;
    if (next.low > prev.high && next.low - prev.high >= minGap) {
      side = "bullish";
      low = prev.high;
      high = next.low;
    } else if (next.high < prev.low && prev.low - next.high >= minGap) {
      side = "bearish";
      low = next.high;
      high = prev.low;
    }
    if (!side) continue;

    let status: GapStatus = "open";
    let filledAt: string | null = null;
    for (let j = i + 2; j < bars.length; j++) {
      const bar = bars[j]!;
      const entered = bar.low <= high && bar.high >= low;
      if (!entered) continue;
      const full = side === "bullish" ? bar.low <= low : bar.high >= high;
      if (full) {
        status = "filled";
        filledAt = bar.time;
        break;
      }
      status = "partial";
      filledAt = bar.time;
    }
    found.push({
      id: `fvg-${side}-${mid.time}-${roundPrice(low)}`,
      side,
      time: mid.time,
      low: roundPrice(low),
      high: roundPrice(high),
      status,
      filledAt,
    });
  }

  const deduped: FairValueGap[] = [];
  for (const gap of found) {
    const twin = deduped.find(
      (g) => g.side === gap.side && overlapRatio(g.low, g.high, gap.low, gap.high) > 0.7
    );
    if (!twin) {
      deduped.push(gap);
      continue;
    }
    const wider = gap.high - gap.low > twin.high - twin.low;
    if (wider) {
      const idx = deduped.indexOf(twin);
      deduped[idx] = gap;
    }
  }

  const openish = deduped.filter((g) => g.status !== "filled");
  const filled = deduped.filter((g) => g.status === "filled").slice(-3);
  return [...openish.slice(-8), ...filled].sort((a, b) => a.time.localeCompare(b.time));
}
