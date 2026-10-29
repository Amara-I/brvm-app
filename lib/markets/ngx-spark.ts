// Aperçu « 1 an » de la liste NGX : mêmes séries ajustées que la fiche et le screener (cache chart_series 1A),
// réduites à ~48 points côté serveur pour garder la page légère.

import type { ChartClosePoint } from "@/lib/charts/indicators";

const DAY_MS = 24 * 3600 * 1000;

function shiftIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Valeurs de clôture sur 1 an glissant (se terminant à la dernière séance).
 * Le point de départ est la séance la plus proche avant J-365 (au plus 10 jours avant), comme le calcul de « Var. 1 an » ;
 * s'il n'y en a pas, la courbe démarre à la première séance dans la fenêtre. Moins de 2 points → [] (N/D).
 */
export function ngxSparkValues(points: ChartClosePoint[], maxPoints = 48): number[] {
  const pts = points.filter((p) => p.value > 0).sort((a, b) => a.time.localeCompare(b.time));
  if (pts.length < 2) return [];
  const last = pts[pts.length - 1]!;
  const target = shiftIso(last.time, -365);
  let ref: ChartClosePoint | null = null;
  for (const p of pts) {
    if (p.time <= target) ref = p;
    else break;
  }
  const window = pts.filter((p) => p.time >= target);
  const series = ref && ref.time >= shiftIso(target, -10) ? [ref, ...window] : window;
  if (series.length < 2) return [];
  const values = series.map((p) => p.value);
  if (values.length <= maxPoints) return values.map(round);
  const out: number[] = [];
  for (let i = 0; i < maxPoints; i += 1) out.push(values[Math.round((i / (maxPoints - 1)) * (values.length - 1))]!);
  return out.map(round);
}

const round = (v: number) => Math.round(v * 100) / 100;
