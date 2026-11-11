// Trois scénarios chiffrés (haussier, neutre, baissier) à partir des zones
// réellement détectées. Les prix absents restent null.

import { roundPrice } from "./bars";
import type { LiquiditySnapshot, ScenarioBias, ScenarioPlan, SrZone, StructureSnapshot } from "./types";

function money(n: number): string {
  return Math.round(n).toLocaleString("fr-FR");
}

function moneyEn(n: number): string {
  return Math.round(n).toLocaleString("en-GB");
}

function nearest(zones: SrZone[], kind: SrZone["kind"], last: number, side: "below" | "above"): SrZone | null {
  const pool = zones.filter((z) => z.kind === kind && (side === "below" ? z.mid < last : z.mid > last));
  pool.sort((a, b) => Math.abs(a.mid - last) - Math.abs(b.mid - last));
  return pool[0] ?? null;
}

function rr(entry: number, stop: number, target: number, side: "long" | "short"): number | null {
  const risk = side === "long" ? entry - stop : stop - entry;
  const reward = side === "long" ? target - entry : entry - target;
  if (!(risk > 0) || !(reward > 0)) return null;
  return Math.round((reward / risk) * 10) / 10;
}

function reactionFr(zone: SrZone | null, role: "support" | "resistance"): string {
  if (!zone || zone.touches < 1) return "Aucun niveau historique proche n'est assez répété pour appuyer ce scénario.";
  const price = money(zone.mid);
  if (role === "support") {
    return `Le support vers ${price} FCFA a été testé ${zone.touches} fois : le cours a rebondi ${zone.bounces} fois et l'a cassé ${zone.breaks} fois.`;
  }
  return `La résistance vers ${price} FCFA a été testée ${zone.touches} fois : le cours a été rejeté ${zone.bounces} fois et l'a dépassée ${zone.breaks} fois.`;
}

function reactionEn(zone: SrZone | null, role: "support" | "resistance"): string {
  if (!zone || zone.touches < 1) return "No nearby historical level has been retested enough to support this scenario.";
  const price = moneyEn(zone.mid);
  if (role === "support") {
    return `Support near ${price} FCFA was tested ${zone.touches} times: price bounced ${zone.bounces} times and broke it ${zone.breaks} times.`;
  }
  return `Resistance near ${price} FCFA was tested ${zone.touches} times: price was rejected ${zone.bounces} times and broke it ${zone.breaks} times.`;
}

function normalizeProbs(raw: Record<ScenarioBias, number>): Record<ScenarioBias, number> {
  const keys: ScenarioBias[] = ["bullish", "neutral", "bearish"];
  const sum = keys.reduce((acc, key) => acc + raw[key], 0) || 1;
  const exact = keys.map((key) => ({ key, value: (raw[key] / sum) * 100 }));
  const floors = exact.map((row) => ({ ...row, base: Math.floor(row.value), frac: row.value - Math.floor(row.value) }));
  let left = 100 - floors.reduce((acc, row) => acc + row.base, 0);
  floors.sort((a, b) => b.frac - a.frac);
  for (const row of floors) {
    if (left <= 0) break;
    row.base += 1;
    left -= 1;
  }
  return {
    bullish: floors.find((r) => r.key === "bullish")!.base,
    neutral: floors.find((r) => r.key === "neutral")!.base,
    bearish: floors.find((r) => r.key === "bearish")!.base,
  };
}

function probabilities(score: number, illiquid: boolean): Record<ScenarioBias, number> {
  if (illiquid) return { bullish: 30, neutral: 40, bearish: 30 };
  return normalizeProbs({
    bullish: Math.max(8, 34 + score * 0.45),
    bearish: Math.max(8, 34 - score * 0.45),
    neutral: Math.max(10, 40 - Math.abs(score) * 0.22),
  });
}

function band(anchor: number, atr: number): { low: number; high: number } {
  const pad = Math.max(atr * 0.25, anchor * 0.004);
  return { low: roundPrice(anchor - pad), high: roundPrice(anchor + pad) };
}

export function buildScenarios(
  structure: StructureSnapshot,
  zones: SrZone[],
  timing: number,
  liquidity: LiquiditySnapshot
): ScenarioPlan[] {
  const last = structure.lastClose;
  const atr = structure.atr14 != null && structure.atr14 > 0 ? structure.atr14 : last != null ? last * 0.015 : null;
  const probs = probabilities(timing, liquidity.illiquid);
  if (last == null || atr == null) {
    const ndFr = "Pas assez de séances pour dire comment le cours a réagi aux anciens niveaux (N/D).";
    const ndEn = "Not enough sessions to say how price reacted at past levels (N/D).";
    return (["bullish", "neutral", "bearish"] as const).map((bias) => ({
      id: bias,
      bias,
      probability: probs[bias],
      headlineFr: "Scénario non chiffré.",
      headlineEn: "Scenario not priced.",
      explanationFr: ndFr,
      explanationEn: ndEn,
      entryLow: null,
      entryHigh: null,
      invalidation: null,
      targets: [],
      riskReward: null,
    }));
  }

  const support = nearest(zones, "support", last, "below") ?? zones.filter((z) => z.kind === "support").sort((a, b) => b.mid - a.mid)[0] ?? null;
  const resistance =
    nearest(zones, "resistance", last, "above") ?? zones.filter((z) => z.kind === "resistance").sort((a, b) => a.mid - b.mid)[0] ?? null;
  const nextResistance = zones
    .filter((z) => z.kind === "resistance" && resistance && z.mid > resistance.mid + atr * 0.3)
    .sort((a, b) => a.mid - b.mid)[0];
  const nextSupport = zones
    .filter((z) => z.kind === "support" && support && z.mid < support.mid - atr * 0.3)
    .sort((a, b) => b.mid - a.mid)[0];

  const bullEntryAnchor = support ? Math.min(last, support.high) : last - atr * 0.4;
  const bullEntry = support ? { low: support.low, high: roundPrice(Math.max(support.high, Math.min(last, support.high + atr * 0.2))) } : band(bullEntryAnchor, atr);
  if (bullEntry.high < bullEntry.low) bullEntry.high = bullEntry.low;
  const bullStop = roundPrice((support ? support.low : last - atr) - atr * 0.25);
  const bullT1 = roundPrice(resistance ? resistance.mid : last + atr * 2);
  const bullT2 = roundPrice(nextResistance ? nextResistance.mid : bullT1 + atr * 1.5);
  const bullEntryMid = (bullEntry.low + bullEntry.high) / 2;
  const bullRr = rr(bullEntryMid, bullStop, bullT1, "long");

  const bearEntryAnchor = resistance ? Math.max(last, resistance.low) : last + atr * 0.4;
  const bearEntry = resistance
    ? { low: resistance.low, high: resistance.high }
    : band(bearEntryAnchor, atr);
  const bearStop = roundPrice((resistance ? resistance.high : last + atr) + atr * 0.25);
  const bearT1 = roundPrice(support ? support.mid : last - atr * 2);
  const bearT2 = roundPrice(nextSupport ? nextSupport.mid : bearT1 - atr * 1.5);
  const bearEntryMid = (bearEntry.low + bearEntry.high) / 2;
  const bearRr = rr(bearEntryMid, bearStop, bearT1, "short");

  const rangeLow = support ? support.mid : last - atr;
  const rangeHigh = resistance ? resistance.mid : last + atr;
  const mid = (rangeLow + rangeHigh) / 2;
  const neutralEntry = band(mid, atr * 0.35);
  const closerToHigh = Math.abs(last - rangeHigh) < Math.abs(last - rangeLow);
  const neutralStop = roundPrice(closerToHigh ? rangeHigh + atr * 0.35 : rangeLow - atr * 0.35);
  const neutralTarget = roundPrice(closerToHigh ? rangeLow : rangeHigh);
  const neutralRr = rr((neutralEntry.low + neutralEntry.high) / 2, neutralStop, neutralTarget, closerToHigh ? "short" : "long");

  const structureFr =
    structure.bias === "bullish"
      ? "Les derniers sommets et creux montent."
      : structure.bias === "bearish"
        ? "Les derniers sommets et creux descendent."
        : "Les derniers sommets et creux ne forment pas une tendance claire.";
  const structureEn =
    structure.bias === "bullish"
      ? "Recent peaks and troughs are rising."
      : structure.bias === "bearish"
        ? "Recent peaks and troughs are falling."
        : "Recent peaks and troughs do not form a clear trend.";

  const bullFr = `${reactionFr(support, "support")} ${structureFr}`;
  const bullEn = `${reactionEn(support, "support")} ${structureEn}`;
  const bearFr = `${reactionFr(resistance, "resistance")} ${structureFr}`;
  const bearEn = `${reactionEn(resistance, "resistance")} ${structureEn}`;
  const neuZone = closerToHigh ? resistance : support;
  const neuRole = closerToHigh ? "resistance" : "support";
  const neuFr = `${reactionFr(neuZone, neuRole)} Le cours oscille entre ${money(rangeLow)} et ${money(rangeHigh)} FCFA.`;
  const neuEn = `${reactionEn(neuZone, neuRole)} Price is oscillating between ${moneyEn(rangeLow)} and ${moneyEn(rangeHigh)} FCFA.`;

  const plans: ScenarioPlan[] = [
    {
      id: "bullish",
      bias: "bullish",
      probability: probs.bullish,
      headlineFr: "Hausse tant que le cours reste au-dessus de l'invalidation.",
      headlineEn: "Upside while price stays above invalidation.",
      explanationFr: bullFr,
      explanationEn: bullEn,
      entryLow: bullEntry.low,
      entryHigh: bullEntry.high,
      invalidation: bullStop,
      targets: [bullT1, bullT2],
      riskReward: bullRr,
    },
    {
      id: "neutral",
      bias: "neutral",
      probability: probs.neutral,
      headlineFr: "Aller-retour dans le range, sans nouvelle tendance.",
      headlineEn: "A round trip inside the range, without a new trend.",
      explanationFr: neuFr,
      explanationEn: neuEn,
      entryLow: neutralEntry.low,
      entryHigh: neutralEntry.high,
      invalidation: neutralStop,
      targets: [neutralTarget],
      riskReward: neutralRr,
    },
    {
      id: "bearish",
      bias: "bearish",
      probability: probs.bearish,
      headlineFr: "Baisse tant que le cours ne repasse pas au-dessus de l'invalidation.",
      headlineEn: "Downside while price stays below invalidation.",
      explanationFr: bearFr,
      explanationEn: bearEn,
      entryLow: bearEntry.low,
      entryHigh: bearEntry.high,
      invalidation: bearStop,
      targets: [bearT1, bearT2],
      riskReward: bearRr,
    },
  ];
  return plans;
}
