// Types + helpers purs pour listes / composition d'indices (sans Prisma / React).

import { dataSourceLabel } from "@/lib/api/data-source-label";
import {
  INDEX_FAMILY_LABELS,
  familySortRank,
  resolveIndexCatalog,
  type IndexCompositionKind,
  type IndexFamily,
} from "@/lib/markets/index-catalog";
import type { IndexHistoryPoint, IndexStats } from "@/lib/markets/index-stats";

export interface MarketIndexListItem {
  code: string;
  name: string;
  family: IndexFamily;
  familyLabel: string;
  description: string;
  lastValue: number | null;
  changePercent: number | null;
  date: string | null;
  source: string | null;
  sourceLabel: string;
  historyPoints: number;
}

export interface IndexConstituent {
  ticker: string;
  name: string;
  sector: string;
  lastPrice: number | null;
}

export interface MarketIndexComposition {
  kind: IndexCompositionKind;
  note: string;
  sectorName: string | null;
  constituents: IndexConstituent[];
}

export interface MarketIndexDetail extends MarketIndexListItem {
  stats: IndexStats;
  series: IndexHistoryPoint[];
  composition: MarketIndexComposition;
}

export interface IndexPeerCompany {
  ticker: string;
  name: string;
  sector: string;
  lastPrice: number | null;
}

export function compositionNote(kind: IndexCompositionKind, sectorName?: string): string {
  if (kind === "all_listed") {
    return "Univers de cote : toutes les sociétés actives suivies en base. Pondérations officielles N/D.";
  }
  if (kind === "sector_peers") {
    return `Sociétés du secteur « ${sectorName ?? "N/D"} » en base — ce n’est pas la composition officielle pondérée. Pondérations N/D.`;
  }
  return "Composition officielle non disponible en base.";
}

export function sortIndexItems(items: MarketIndexListItem[]): MarketIndexListItem[] {
  return [...items].sort((a, b) => {
    const fam = familySortRank(a.family) - familySortRank(b.family);
    if (fam !== 0) return fam;
    if (a.code === "BRVM_COMPOSITE") return -1;
    if (b.code === "BRVM_COMPOSITE") return 1;
    if (a.code === "BRVM_30") return -1;
    if (b.code === "BRVM_30") return 1;
    return a.name.localeCompare(b.name, "fr");
  });
}

export function toIndexListItem(
  code: string,
  name: string,
  last: { value: number; changePercent: number | null; date: string; source: string } | null,
  historyPoints: number
): MarketIndexListItem {
  const catalog = resolveIndexCatalog(code, name);
  return {
    code,
    name,
    family: catalog.family,
    familyLabel: INDEX_FAMILY_LABELS[catalog.family],
    description: catalog.description,
    lastValue: last?.value ?? null,
    changePercent: last?.changePercent ?? null,
    date: last?.date ?? null,
    source: last?.source ?? null,
    sourceLabel: dataSourceLabel(last?.source ?? null),
    historyPoints,
  };
}

export function buildIndexComposition(
  kind: IndexCompositionKind,
  sectorName: string | undefined,
  companies: IndexPeerCompany[]
): MarketIndexComposition {
  let constituents: IndexConstituent[] = [];
  if (kind === "all_listed") {
    constituents = companies.map((c) => ({
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      lastPrice: c.lastPrice,
    }));
  } else if (kind === "sector_peers" && sectorName) {
    constituents = companies
      .filter((c) => c.sector === sectorName)
      .map((c) => ({
        ticker: c.ticker,
        name: c.name,
        sector: c.sector,
        lastPrice: c.lastPrice,
      }));
  }

  constituents.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return {
    kind,
    note: compositionNote(kind, sectorName),
    sectorName: sectorName ?? null,
    constituents,
  };
}

export function groupIndicesByFamily(items: MarketIndexListItem[]): Array<{
  family: IndexFamily;
  label: string;
  items: MarketIndexListItem[];
}> {
  const buckets = new Map<IndexFamily, MarketIndexListItem[]>();
  for (const item of items) {
    const list = buckets.get(item.family) ?? [];
    list.push(item);
    buckets.set(item.family, list);
  }
  return (["principal", "sectoriel", "autre"] as const)
    .filter((family) => (buckets.get(family)?.length ?? 0) > 0)
    .map((family) => ({
      family,
      label: INDEX_FAMILY_LABELS[family],
      items: buckets.get(family)!,
    }));
}
