// Snapshot indices + movers pour le bandeau marché de /marche.

import { prisma } from "@/lib/prisma";
import { isHeadlineIndex } from "@/lib/markets/index-catalog";

export interface MarketIndexSnapshot {
  code: string;
  name: string;
  value: number;
  changePercent: number | null;
  date: string;
}

export interface MarketSummarySnapshot {
  headlineIndices: MarketIndexSnapshot[];
  otherIndices: MarketIndexSnapshot[];
  asOf: string;
}

export async function getMarketSummarySnapshot(): Promise<MarketSummarySnapshot> {
  const indices = await prisma.marketIndex.findMany({
    include: {
      values: {
        where: { isCanonical: true },
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  const serialized = indices
    .filter((idx) => idx.values.length > 0)
    .map((idx) => ({
      code: idx.code,
      name: idx.name,
      value: Number(idx.values[0]!.value),
      changePercent: idx.values[0]!.changePercent !== null ? Number(idx.values[0]!.changePercent) : null,
      date: idx.values[0]!.date.toISOString().slice(0, 10),
    }));

  return {
    headlineIndices: serialized.filter((i) => isHeadlineIndex(i.code)),
    otherIndices: serialized.filter((i) => !isHeadlineIndex(i.code)).slice(0, 8),
    asOf: new Date().toISOString(),
  };
}
