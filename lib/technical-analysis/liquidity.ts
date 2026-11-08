// Liquidité : volumes bas, séances sans écart de cours, jours manquants, gaps larges.
// Un volume absent (null) n'est pas traité comme un volume nul : le cache compact
// n'écrit pas les volumes à 0.

import type { LiquiditySnapshot, PriceBar } from "./types";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function daySpan(a: string, b: string): number {
  const ms = Date.parse(`${b.slice(0, 10)}T00:00:00.000Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return 1;
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function assessLiquidity(bars: PriceBar[]): LiquiditySnapshot {
  const n = bars.length;
  if (n < 2) {
    return {
      illiquid: true,
      score: 80,
      warningFr:
        "Liquidité faible : historique de séances insuffisant. Le signal fort est écarté et la confiance reste basse.",
      warningEn: "Weak liquidity: not enough trading sessions. Strong signals are withheld and confidence stays low.",
      flatShare: null,
      zeroVolumeShare: null,
      wideGapShare: null,
      medianGapDays: null,
      bars: n,
      volumeKnown: false,
    };
  }

  let flat = 0;
  let wide = 0;
  let volumeKnown = 0;
  let volumeZero = 0;
  const volumes: number[] = [];
  const gaps: number[] = [];
  for (let i = 1; i < n; i++) {
    const prev = bars[i - 1]!;
    const bar = bars[i]!;
    if (bar.close === prev.close) flat += 1;
    if (prev.close > 0 && Math.abs(bar.close - prev.close) / prev.close > 0.12) wide += 1;
    gaps.push(daySpan(prev.time, bar.time));
    if (bar.volume != null) {
      volumeKnown += 1;
      volumes.push(bar.volume);
      if (bar.volume <= 0) volumeZero += 1;
    }
  }
  const steps = n - 1;
  const flatShare = flat / steps;
  const wideGapShare = wide / steps;
  const medianGapDays = median(gaps);
  const volumeKnownShare = volumeKnown / n;
  const zeroVolumeShare = volumeKnown > 0 ? volumeZero / volumeKnown : null;
  const medianVolume = median(volumes.filter((v) => v > 0));

  let score = 0;
  if (n < 30) score += 40;
  else if (n < 60) score += 15;
  score += Math.round(flatShare * 45);
  score += Math.round(wideGapShare * 60);
  if (medianGapDays != null && medianGapDays > 5) score += 25;
  if (volumeKnownShare >= 0.5 && zeroVolumeShare != null && zeroVolumeShare >= 0.4) score += 25;
  if (volumeKnownShare >= 0.5 && medianVolume != null && medianVolume < 200) score += 20;
  score = Math.max(0, Math.min(100, score));
  const illiquid = score >= 45;

  const warningFr = illiquid
    ? "Liquidité faible (volumes modestes, nombreuses séances sans écart ou gaps larges). Confiance basse : pas de signal fort."
    : null;
  const warningEn = illiquid
    ? "Weak liquidity (light volume, many unchanged sessions or wide gaps). Confidence stays low: no strong signal."
    : null;

  return {
    illiquid,
    score,
    warningFr,
    warningEn,
    flatShare: Math.round(flatShare * 1000) / 1000,
    zeroVolumeShare: zeroVolumeShare == null ? null : Math.round(zeroVolumeShare * 1000) / 1000,
    wideGapShare: Math.round(wideGapShare * 1000) / 1000,
    medianGapDays,
    bars: n,
    volumeKnown: volumeKnownShare >= 0.5,
  };
}
