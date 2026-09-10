// Indicateurs techniques calculables sur séries de clôtures (cahier plateforme v2).
// Valeurs absentes → null (affichage "N/D"), jamais inventées.

export interface ClosePoint {
  time: string;
  value: number;
  volume?: number | null;
}

function closesOnly(points: ClosePoint[]): number[] {
  return points.map((p) => p.value).filter((v) => v > 0);
}

export function computeEmaSeries(values: number[], period: number): Array<number | null> {
  if (period < 1 || values.length < period) return values.map(() => null);
  const k = 2 / (period + 1);
  const out: Array<number | null> = values.map(() => null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i]!;
  let ema = sum / period;
  out[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = values[i]! * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

export function computeSmaLast(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** RSI Wilder (période 14 par défaut). */
export function computeRsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i]! - values[i - 1]!;
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i]! - values[i - 1]!;
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

export interface MacdSnapshot {
  macd: number;
  signal: number;
  histogram: number;
}

export function computeMacd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdSnapshot | null {
  if (values.length < slow + signalPeriod) return null;
  const emaFast = computeEmaSeries(values, fast);
  const emaSlow = computeEmaSeries(values, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (emaFast[i] == null || emaSlow[i] == null) continue;
    macdLine.push(emaFast[i]! - emaSlow[i]!);
  }
  if (macdLine.length < signalPeriod) return null;
  const signalEma = computeEmaSeries(macdLine, signalPeriod);
  const last = macdLine.length - 1;
  const macd = macdLine[last]!;
  const signal = signalEma[last];
  if (signal == null) return null;
  return {
    macd: Math.round(macd * 100) / 100,
    signal: Math.round(signal * 100) / 100,
    histogram: Math.round((macd - signal) * 100) / 100,
  };
}

export type CrossSignal = "golden_cross" | "death_cross" | "none" | "N/D";

export function detectMaCross(values: number[], fastPeriod = 50, slowPeriod = 200): CrossSignal {
  if (values.length < slowPeriod + 1) return "N/D";
  const smaFastPrev = computeSmaLast(values.slice(0, -1), fastPeriod);
  const smaSlowPrev = computeSmaLast(values.slice(0, -1), slowPeriod);
  const smaFast = computeSmaLast(values, fastPeriod);
  const smaSlow = computeSmaLast(values, slowPeriod);
  if (smaFastPrev == null || smaSlowPrev == null || smaFast == null || smaSlow == null) return "N/D";
  if (smaFastPrev <= smaSlowPrev && smaFast > smaSlow) return "golden_cross";
  if (smaFastPrev >= smaSlowPrev && smaFast < smaSlow) return "death_cross";
  return "none";
}

export interface TechnicalSnapshot {
  available: boolean;
  points: number;
  rsi14: number | null;
  sma10: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  macd: MacdSnapshot | null;
  maCross: CrossSignal;
  /** Score technique court terme 0–100 dérivé des indicateurs, ou null. */
  shortTermScore: number | null;
  notes: string[];
}

/**
 * Agrège les indicateurs v2 sur une série de clôtures.
 * Si &lt; 30 points : available=false, shortTermScore=null.
 */
export function computeTechnicalSnapshot(points: ClosePoint[]): TechnicalSnapshot {
  const values = closesOnly(points);
  const notes: string[] = [];
  if (values.length < 30) {
    return {
      available: false,
      points: values.length,
      rsi14: null,
      sma10: null,
      sma20: null,
      sma50: null,
      sma200: null,
      macd: null,
      maCross: "N/D",
      shortTermScore: null,
      notes: ["Indicateurs techniques N/D (série inférieure à 30 clôtures)."],
    };
  }

  const rsi14 = computeRsi(values, 14);
  const sma10 = computeSmaLast(values, 10);
  const sma20 = computeSmaLast(values, 20);
  const sma50 = computeSmaLast(values, Math.min(50, values.length));
  const sma200 = values.length >= 200 ? computeSmaLast(values, 200) : null;
  const macd = computeMacd(values);
  const maCross = detectMaCross(values, 50, Math.min(200, values.length));

  let score = 50;
  if (rsi14 != null) {
    if (rsi14 < 30) {
      score += 18;
      notes.push(`RSI(14)=${rsi14} (zone de survente).`);
    } else if (rsi14 > 70) {
      score -= 18;
      notes.push(`RSI(14)=${rsi14} (zone de surachat).`);
    } else if (rsi14 >= 45 && rsi14 <= 60) {
      score += 6;
      notes.push(`RSI(14)=${rsi14} (zone neutre favorable).`);
    } else {
      notes.push(`RSI(14)=${rsi14}.`);
    }
  }
  if (macd) {
    if (macd.histogram > 0) {
      score += 12;
      notes.push("MACD histogramme positif.");
    } else if (macd.histogram < 0) {
      score -= 12;
      notes.push("MACD histogramme négatif.");
    }
  }
  const last = values[values.length - 1]!;
  if (sma20 != null) {
    if (last > sma20) score += 8;
    else score -= 8;
  }
  if (sma50 != null && sma20 != null) {
    if (sma20 > sma50) score += 6;
    else score -= 6;
  }
  if (maCross === "golden_cross") {
    score += 10;
    notes.push("Golden cross détecté (SMA rapide > SMA lente).");
  } else if (maCross === "death_cross") {
    score -= 10;
    notes.push("Death cross détecté (SMA rapide < SMA lente).");
  }

  return {
    available: true,
    points: values.length,
    rsi14,
    sma10: sma10 != null ? Math.round(sma10 * 100) / 100 : null,
    sma20: sma20 != null ? Math.round(sma20 * 100) / 100 : null,
    sma50: sma50 != null ? Math.round(sma50 * 100) / 100 : null,
    sma200: sma200 != null ? Math.round(sma200 * 100) / 100 : null,
    macd,
    maCross,
    shortTermScore: Math.min(100, Math.max(0, Math.round(score))),
    notes,
  };
}
