// Série BRVM Composite pour la carte marché de la landing.
// Lecture seule des niveaux canoniques déjà en base ; renvoie null si l'indice
// ou la base est indisponible (la carte masque alors le graphe, sans inventer).

import { getMarketIndexDetail } from "@/lib/api/market-indices";
import { cleanHeroSeries, downsampleHeroSeries, type HeroPoint } from "@/lib/landing/hero-chart";

/** ~6 ans de séances ≈ 1 500 points ; on en garde ≤ 700 vrais points (min/max par tranche). */
const MAX_POINTS_SENT = 700;
const HERO_HISTORY_YEARS = 5;

export interface HeroIndexSeries {
  code: string;
  points: HeroPoint[];
}

export async function loadHeroIndexSeries(): Promise<HeroIndexSeries | null> {
  try {
    const detail = await getMarketIndexDetail("BRVM_COMPOSITE", "BRVM");
    if (!detail) return null;
    const clean = cleanHeroSeries(detail.series.map((p) => ({ time: p.time, value: p.value })));
    if (clean.length < 2) return null;
    // On n'envoie au client que ~5 ans (+ marge), pas tout l'historique.
    const last = clean[clean.length - 1]!.time;
    const cutoff = new Date(`${last}T00:00:00.000Z`);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - HERO_HISTORY_YEARS);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    let startIdx = 0;
    for (let i = 0; i < clean.length; i++) {
      if (clean[i]!.time <= cutoffIso) startIdx = i;
      else break;
    }
    const windowed = clean.slice(startIdx);
    return { code: detail.code, points: downsampleHeroSeries(windowed, MAX_POINTS_SENT) };
  } catch (err) {
    console.error("[landing] série BRVM Composite indisponible", err instanceof Error ? err.message : err);
    return null;
  }
}
