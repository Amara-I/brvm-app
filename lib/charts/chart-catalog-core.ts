// Fonctions pures du catalogue de graphes (liens, groupement, filtre).
// Sans Prisma ni cache React — testables en vitest.

import { companyHref, indexHref, normalizeExchange } from "@/lib/search/routes";

export type ChartCatalogKind = "company" | "index";

export type ChartCatalogEntry = {
  /** `${exchange}:${kind}:${symbol}` — clé stable pour React et les tests. */
  key: string;
  symbol: string;
  name: string;
  exchange: string;
  kind: ChartCatalogKind;
  sector: string | null;
  countryFlag: string;
  color: string;
  href: string;
};

export type ChartCatalogGroup = {
  id: string;
  exchange: string;
  kind: ChartCatalogKind;
  items: ChartCatalogEntry[];
};

export type ChartCatalog = {
  entries: ChartCatalogEntry[];
  groups: ChartCatalogGroup[];
  visibleCompanies: number;
  visibleIndices: number;
  hiddenCompanies: number;
  hiddenIndices: number;
};

export const INDEX_COLOR = "#D4A843";
const NGX_FLAG = "🇳🇬";

const KIND_ORDER: ChartCatalogKind[] = ["company", "index"];

/** Lien vers la vue graphe déjà en place pour ce type de valeur. */
export function chartCatalogHref(entry: {
  kind: ChartCatalogKind;
  symbol: string;
  exchange?: string | null;
}): string {
  const exchange = normalizeExchange(entry.exchange);
  const symbol = entry.symbol.trim().toUpperCase();
  if (entry.kind === "company") {
    if (exchange === "BRVM") return `/graphes?ticker=${encodeURIComponent(symbol)}`;
    return `${companyHref({ ticker: symbol, exchange })}?tab=charts`;
  }
  const base = indexHref({ code: symbol, exchange });
  // Workbench détaillé NGX : convention déjà utilisée sur les fiches d'indice.
  if (exchange === "NGX") return `${base}?vue=graphe`;
  return base;
}

export function chartCatalogKey(entry: {
  kind: ChartCatalogKind;
  symbol: string;
  exchange?: string | null;
}): string {
  return `${normalizeExchange(entry.exchange)}:${entry.kind}:${entry.symbol.trim().toUpperCase()}`;
}

function exchangeRank(exchange: string): number {
  if (exchange === "BRVM") return 0;
  if (exchange === "NGX") return 1;
  return 10;
}

/** Indices de place en tête, puis ordre alphabétique du code. */
export function indexSortRank(symbol: string): number {
  const code = symbol.trim().toUpperCase();
  if (code === "BRVM_COMPOSITE" || code === "NGX_ASI") return 0;
  if (code === "BRVM_30" || code === "NGX30") return 1;
  return 10;
}

function compareEntries(a: ChartCatalogEntry, b: ChartCatalogEntry): number {
  if (a.kind === "index" && b.kind === "index") {
    const rank = indexSortRank(a.symbol) - indexSortRank(b.symbol);
    if (rank !== 0) return rank;
  }
  return a.symbol.localeCompare(b.symbol, "fr");
}

export function groupChartCatalog(entries: ChartCatalogEntry[]): ChartCatalogGroup[] {
  const map = new Map<string, ChartCatalogGroup>();
  for (const entry of entries) {
    const id = `${entry.exchange}-${entry.kind}`;
    let group = map.get(id);
    if (!group) {
      group = { id, exchange: entry.exchange, kind: entry.kind, items: [] };
      map.set(id, group);
    }
    group.items.push(entry);
  }
  for (const group of map.values()) {
    group.items.sort(compareEntries);
  }
  return [...map.values()].sort((a, b) => {
    const byExchange = exchangeRank(a.exchange) - exchangeRank(b.exchange);
    if (byExchange !== 0) return byExchange;
    if (a.exchange !== b.exchange) return a.exchange.localeCompare(b.exchange, "fr");
    return KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
  });
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Filtre local (ticker, nom, place, secteur) — aucune requête supplémentaire. */
export function filterChartCatalog(entries: ChartCatalogEntry[], query: string): ChartCatalogEntry[] {
  const needle = fold(query.trim());
  if (!needle) return entries;
  return entries.filter((entry) => {
    const hay = fold(
      `${entry.symbol} ${entry.name} ${entry.exchange} ${entry.sector ?? ""} ${entry.symbol.replace(/_/g, " ")}`
    );
    return hay.includes(needle);
  });
}

export function hiddenCatalogCounts(
  total: { companies: number; indices: number },
  visible: { companies: number; indices: number }
): { hiddenCompanies: number; hiddenIndices: number } {
  return {
    hiddenCompanies: Math.max(0, total.companies - visible.companies),
    hiddenIndices: Math.max(0, total.indices - visible.indices),
  };
}
