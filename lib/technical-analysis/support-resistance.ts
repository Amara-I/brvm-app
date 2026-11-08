// Zones de support / résistance : swings regroupés, force = tests × récence.

import { roundPrice } from "./bars";
import type { PriceBar, SrZone, ZoneKind } from "./types";

export interface SwingPoint {
  index: number;
  time: string;
  price: number;
  kind: "high" | "low";
}

export function detectSwings(bars: PriceBar[], wing = 3): SwingPoint[] {
  const span = bars.length < 24 ? 2 : wing;
  if (bars.length < span * 2 + 1) return [];
  const out: SwingPoint[] = [];
  for (let i = span; i < bars.length - span; i++) {
    const bar = bars[i]!;
    let isHigh = true;
    let isLow = true;
    // Pivots sur la clôture : les bougies reconstruites (O = clôture précédente)
    // partagent le plus haut / plus bas avec la bougie suivante, ce qui
    // efface les swings si on compare les mèches.
    for (let k = 1; k <= span; k++) {
      if (bar.close <= bars[i - k]!.close || bar.close <= bars[i + k]!.close) isHigh = false;
      if (bar.close >= bars[i - k]!.close || bar.close >= bars[i + k]!.close) isLow = false;
    }
    if (isHigh === isLow) continue;
    out.push({
      index: i,
      time: bar.time,
      price: bar.close,
      kind: isHigh ? "high" : "low",
    });
  }
  return out;
}

function cluster(points: SwingPoint[], tolerance: number): SwingPoint[][] {
  const sorted = [...points].sort((a, b) => a.price - b.price || a.index - b.index);
  const groups: SwingPoint[][] = [];
  for (const point of sorted) {
    const current = groups[groups.length - 1];
    if (!current) {
      groups.push([point]);
      continue;
    }
    const mean = current.reduce((sum, p) => sum + p.price, 0) / current.length;
    if (Math.abs(point.price - mean) <= tolerance) current.push(point);
    else groups.push([point]);
  }
  return groups;
}

function countReactions(
  bars: PriceBar[],
  low: number,
  high: number,
  kind: ZoneKind,
  atr: number
): { touches: number; bounces: number; breaks: number; lastTouch: string | null } {
  const cushion = Math.max(atr * 0.15, (high - low) * 0.05);
  let inside = false;
  let touches = 0;
  let bounces = 0;
  let breaks = 0;
  let lastTouch: string | null = null;
  const starts: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!;
    const hits = bar.high >= low && bar.low <= high;
    if (hits && !inside) {
      touches += 1;
      lastTouch = bar.time;
      starts.push(i);
      inside = true;
    } else if (!hits) inside = false;
  }
  for (const start of starts) {
    const end = Math.min(bars.length - 1, start + 10);
    for (let i = start + 1; i <= end; i++) {
      const close = bars[i]!.close;
      if (kind === "resistance") {
        if (close > high) {
          breaks += 1;
          break;
        }
        if (close < low - cushion) {
          bounces += 1;
          break;
        }
      } else {
        if (close < low) {
          breaks += 1;
          break;
        }
        if (close > high + cushion) {
          bounces += 1;
          break;
        }
      }
    }
  }
  return { touches, bounces, breaks, lastTouch };
}

function zoneKind(low: number, high: number, last: number): ZoneKind {
  if (last > high * 1.002) return "support";
  if (last < low * 0.998) return "resistance";
  return "pivot";
}

export function detectSupportResistance(bars: PriceBar[], atr: number | null): SrZone[] {
  if (bars.length < 7) return [];
  const last = bars[bars.length - 1]!.close;
  const ref = atr != null && atr > 0 ? atr : last * 0.015;
  const tolerance = Math.max(ref * 0.45, last * 0.012);
  const swings = detectSwings(bars);
  if (swings.length === 0) return [];

  const zones: SrZone[] = [];
  for (const group of cluster(swings, tolerance)) {
    const prices = group.map((p) => p.price);
    const rawLow = Math.min(...prices);
    const rawHigh = Math.max(...prices);
    const midRaw = (rawLow + rawHigh) / 2;
    const pad = Math.max((rawHigh - rawLow) * 0.08, Math.min(ref * 0.12, midRaw * 0.004));
    const low = roundPrice(rawLow - pad);
    const high = roundPrice(rawHigh + pad);
    const mid = roundPrice((low + high) / 2);
    const kind = zoneKind(low, high, last);
    const reactions = countReactions(bars, low, high, kind === "pivot" ? "support" : kind, ref);
    const touches = Math.max(reactions.touches, group.length);
    const lastIndex = Math.max(...group.map((p) => p.index));
    const recency = bars.length <= 1 ? 1 : lastIndex / (bars.length - 1);
    const strength = Math.max(0, Math.min(100, Math.round(touches * 18 * (0.45 + 0.55 * recency))));
    zones.push({
      id: `sr-${kind}-${mid}`,
      kind,
      low,
      high,
      mid,
      touches,
      recency: Math.round(recency * 100) / 100,
      strength,
      bounces: reactions.bounces,
      breaks: reactions.breaks,
      lastTouch: reactions.lastTouch,
    });
  }

  zones.sort((a, b) => b.strength - a.strength || b.touches - a.touches);
  const kept: SrZone[] = [];
  for (const zone of zones) {
    if (zone.touches < 2 && zone.strength < 20) continue;
    if (kept.some((k) => Math.abs(k.mid - zone.mid) <= tolerance)) continue;
    kept.push(zone);
    if (kept.length >= 8) break;
  }

  const ensure = (kind: "support" | "resistance") => {
    if (kept.some((z) => z.kind === kind)) return;
    const pool = zones
      .filter((z) => z.kind === kind)
      .sort((a, b) => Math.abs(a.mid - last) - Math.abs(b.mid - last));
    const nearest = pool[0];
    if (nearest && !kept.some((k) => k.id === nearest.id)) kept.push(nearest);
  };
  ensure("support");
  ensure("resistance");
  return kept.sort((a, b) => a.mid - b.mid);
}
