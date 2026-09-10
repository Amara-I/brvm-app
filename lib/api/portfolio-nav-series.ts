// Série NAV quotidienne du portefeuille (quantités courantes × closes).
// Simplification documentée : pas de grand livre de transactions — on applique
// les quantités actuelles à chaque jour de l'historique (comme le YTD).

import { prisma } from "@/lib/prisma";

export interface PortfolioNavPoint {
  date: string; // YYYY-MM-DD
  value: number;
  changePercent: number | null; // vs veille
}

export interface PortfolioNavHoldingInput {
  companyId: string;
  quantity: number;
  /** Date d'achat / création ISO YYYY-MM-DD — borne basse de la série. */
  sinceDate: string | null;
}

/**
 * Construit la courbe de valeur du portefeuille jour par jour.
 * @param maxDays plafond (défaut 365) pour limiter la charge.
 */
export async function getPortfolioNavSeries(
  holdings: PortfolioNavHoldingInput[],
  maxDays = 365
): Promise<PortfolioNavPoint[]> {
  const active = holdings.filter((h) => h.quantity > 0 && h.companyId);
  if (active.length === 0) return [];

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  let start = new Date(todayUtc);
  start.setUTCDate(start.getUTCDate() - maxDays);

  // start = max(today-maxDays, min(sinceDates)) — ne remonte pas avant maxDays.
  const sinceDates = active
    .map((h) => h.sinceDate)
    .filter((s): s is string => Boolean(s && /^\d{4}-\d{2}-\d{2}/.test(s)))
    .map((s) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`))
    .filter((d) => !Number.isNaN(d.getTime()));

  if (sinceDates.length > 0) {
    const minSince = new Date(Math.min(...sinceDates.map((d) => d.getTime())));
    if (minSince > start) start = minSince;
  }

  const companyIds = [...new Set(active.map((h) => h.companyId))];
  const rows = await prisma.priceHistory.findMany({
    where: {
      companyId: { in: companyIds },
      isCanonical: true,
      date: { gte: start, lte: todayUtc },
    },
    orderBy: [{ date: "asc" }],
    select: { companyId: true, date: true, closePrice: true },
  });

  const qtyByCompany = new Map<string, number>();
  for (const h of active) {
    qtyByCompany.set(h.companyId, (qtyByCompany.get(h.companyId) ?? 0) + h.quantity);
  }

  return buildNavSeriesFromCloses(
    qtyByCompany,
    rows.map((r) => ({
      companyId: r.companyId,
      date: r.date.toISOString().slice(0, 10),
      closePrice: Number(r.closePrice),
    }))
  );
}

/**
 * Pure : construit la série NAV à partir de closes journaliers déjà filtrés
 * (date <= aujourd'hui). Les closes manquants sont reportés (last known).
 */
export function buildNavSeriesFromCloses(
  qtyByCompany: Map<string, number>,
  closes: Array<{ companyId: string; date: string; closePrice: number }>
): PortfolioNavPoint[] {
  const byDay = new Map<string, Map<string, number>>();
  for (const r of closes) {
    const day = r.date.slice(0, 10);
    let m = byDay.get(day);
    if (!m) {
      m = new Map();
      byDay.set(day, m);
    }
    if (r.closePrice > 0) m.set(r.companyId, r.closePrice);
  }

  const days = [...byDay.keys()].sort();
  const lastClose = new Map<string, number>();
  const series: PortfolioNavPoint[] = [];
  let prevValue: number | null = null;

  for (const day of days) {
    const dayCloses = byDay.get(day)!;
    for (const [cid, px] of dayCloses) {
      if (px > 0) lastClose.set(cid, px);
    }

    let value = 0;
    let covered = 0;
    for (const [cid, qty] of qtyByCompany) {
      const px = lastClose.get(cid);
      if (px == null || !(px > 0)) continue;
      value += qty * px;
      covered += 1;
    }
    if (covered === 0) continue;

    // Variation en % vs veille, 1 décimale (ex. +55.0 pour +55 %).
    const changePercent =
      prevValue != null && prevValue > 0
        ? Math.round(((value - prevValue) / prevValue) * 1000) / 10
        : null;
    series.push({ date: day, value: Math.round(value * 100) / 100, changePercent });
    prevValue = value;
  }

  return series;
}
