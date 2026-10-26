// Snapshot indices pour le bandeau marché de /marche.
// La séance retenue est la plus récente, même si aucune ligne n'est canonique.

import { prisma } from "@/lib/prisma";
import { closeForSession, sessionDayChangePercent, type SessionCloseRow } from "@/lib/api/session-day-change";
import type { DataSourceCode } from "@/lib/ingestion/types";
import { isHeadlineIndex } from "@/lib/markets/index-catalog";

export interface MarketIndexSnapshot {
  code: string;
  name: string;
  value: number;
  changePercent: number | null;
  date: string;
  source: string;
}

export interface MarketSummarySnapshot {
  headlineIndices: MarketIndexSnapshot[];
  otherIndices: MarketIndexSnapshot[];
  asOf: string;
}

export async function loadRecentIndexLevels(): Promise<MarketIndexSnapshot[]> {
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 40);
  const indices = await prisma.marketIndex.findMany({
    select: { id: true, code: true, name: true },
  });
  if (indices.length === 0) return [];
  const values = await prisma.marketIndexValue.findMany({
    where: {
      marketIndexId: { in: indices.map((row) => row.id) },
      date: { lte: now, gte: from },
    },
    select: {
      marketIndexId: true,
      date: true,
      value: true,
      changePercent: true,
      source: true,
      isCanonical: true,
    },
  });
  const byIndex = new Map<string, SessionCloseRow[]>();
  for (const row of values) {
    const value = Number(row.value);
    if (!(value > 0)) continue;
    const list = byIndex.get(row.marketIndexId) ?? [];
    list.push({
      date: row.date.toISOString().slice(0, 10),
      close: value,
      source: row.source as DataSourceCode,
      changePercent: row.changePercent != null ? Number(row.changePercent) : null,
      isCanonical: row.isCanonical,
    });
    byIndex.set(row.marketIndexId, list);
  }
  const out: MarketIndexSnapshot[] = [];
  for (const index of indices) {
    const rows = byIndex.get(index.id) ?? [];
    if (rows.length === 0) continue;
    const dates = [...new Set(rows.map((row) => row.date.slice(0, 10)))].sort();
    const lastDate = dates[dates.length - 1]!;
    const last = closeForSession(rows, lastDate);
    if (!last) continue;
    out.push({
      code: index.code,
      name: index.name,
      value: last.close,
      changePercent: sessionDayChangePercent(rows, []),
      date: last.date.slice(0, 10),
      source: last.source,
    });
  }
  return out;
}

export async function getMarketSummarySnapshot(): Promise<MarketSummarySnapshot> {
  const serialized = await loadRecentIndexLevels();
  return {
    headlineIndices: serialized.filter((i) => isHeadlineIndex(i.code)),
    otherIndices: serialized.filter((i) => !isHeadlineIndex(i.code)).slice(0, 8),
    asOf: new Date().toISOString(),
  };
}
