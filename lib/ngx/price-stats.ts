// Lecture technique simple d'une série de clôtures NGX (tendance, momentum, liquidité, risque).
// Fonctions pures : utilisées pour la conclusion « Trading » et le risque de la fiche.

export interface PricePoint {
  time: string; // YYYY-MM-DD
  value: number;
  volume?: number | null;
}

export interface PriceStats {
  points: number;
  lastClose: number | null;
  lastDate: string | null;
  return1mPercent: number | null;
  return3mPercent: number | null;
  return6mPercent: number | null;
  return1yPercent: number | null;
  sma50: number | null;
  sma200: number | null;
  high52: number | null;
  low52: number | null;
  /** Recul en % depuis le plus haut 52 semaines (≥ 0). */
  drawdownFromHighPercent: number | null;
  /** Volatilité annualisée en % (écarts-types des rendements journaliers × √250). */
  volatilityPercent: number | null;
  /** Valeur moyenne échangée par séance (₦) sur les 60 dernières séances. */
  avgDailyValueNgn: number | null;
  /** Part des 60 dernières séances avec volume > 0. */
  tradedSessionsRatio: number | null;
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function smaLast(values: number[], n: number): number | null {
  if (values.length < n) return null;
  return mean(values.slice(-n));
}

export function priceStats(series: readonly PricePoint[]): PriceStats {
  const pts = series
    .filter((p) => p.value > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.time))
    .sort((a, b) => (a.time < b.time ? -1 : 1));
  const empty: PriceStats = {
    points: pts.length,
    lastClose: null,
    lastDate: null,
    return1mPercent: null,
    return3mPercent: null,
    return6mPercent: null,
    return1yPercent: null,
    sma50: null,
    sma200: null,
    high52: null,
    low52: null,
    drawdownFromHighPercent: null,
    volatilityPercent: null,
    avgDailyValueNgn: null,
    tradedSessionsRatio: null,
  };
  if (pts.length === 0) return empty;
  const last = pts[pts.length - 1];

  const returnOver = (days: number): number | null => {
    const target = shiftDays(last.time, -days);
    // Il faut une séance au plus tard à la date cible, et pas plus de 10 jours avant (sinon l'historique ne couvre pas la période).
    let ref: PricePoint | null = null;
    for (const p of pts) {
      if (p.time <= target) ref = p;
      else break;
    }
    if (!ref || ref.time < shiftDays(target, -10)) return null;
    return ((last.value - ref.value) / ref.value) * 100;
  };

  const closes = pts.map((p) => p.value);
  const yearAgo = shiftDays(last.time, -365);
  const window52 = pts.filter((p) => p.time >= yearAgo);
  const spans52 = pts[0].time <= shiftDays(yearAgo, 10);
  const high52 = window52.length >= 20 && spans52 ? Math.max(...window52.map((p) => p.value)) : null;
  const low52 = window52.length >= 20 && spans52 ? Math.min(...window52.map((p) => p.value)) : null;

  let volatilityPercent: number | null = null;
  const rets: number[] = [];
  for (let i = 1; i < pts.length; i += 1) {
    if (pts[i - 1].value > 0) rets.push(Math.log(pts[i].value / pts[i - 1].value));
  }
  const recent = rets.slice(-250);
  if (recent.length >= 60) {
    const m = mean(recent);
    const variance = recent.reduce((s, r) => s + (r - m) ** 2, 0) / (recent.length - 1);
    volatilityPercent = Math.sqrt(variance) * Math.sqrt(250) * 100;
  }

  const lastSessions = pts.slice(-60);
  let avgDailyValueNgn: number | null = null;
  let tradedSessionsRatio: number | null = null;
  const withVolume = lastSessions.filter((p) => p.volume != null);
  if (lastSessions.length >= 20 && withVolume.length >= 20) {
    avgDailyValueNgn = mean(withVolume.map((p) => p.value * (p.volume ?? 0)));
    tradedSessionsRatio = withVolume.filter((p) => (p.volume ?? 0) > 0).length / lastSessions.length;
  }

  return {
    points: pts.length,
    lastClose: last.value,
    lastDate: last.time,
    return1mPercent: returnOver(30),
    return3mPercent: returnOver(91),
    return6mPercent: returnOver(182),
    return1yPercent: returnOver(365),
    sma50: smaLast(closes, 50),
    sma200: smaLast(closes, 200),
    high52,
    low52,
    drawdownFromHighPercent: high52 ? Math.max(0, ((high52 - last.value) / high52) * 100) : null,
    volatilityPercent,
    avgDailyValueNgn,
    tradedSessionsRatio,
  };
}
