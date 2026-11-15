// Résolution de l'instrument affiché sur /graphes (URL partageable) et
// correspondance avec le catalogue mis en cache (`chart-catalog-v1`).
// Module pur — testé en vitest, sans Prisma ni React.

import { normalizeExchange } from "@/lib/search/routes";
import type { ChartCatalogEntry } from "./chart-catalog-core";

export const DEFAULT_CHART_TICKER = "ABJC";

export type ChartInstrumentRef = {
  kind: "company" | "index";
  symbol: string;
  exchange: string;
};

/** Alias usuels → code d'indice en base (après normalisation casse/tirets). */
const INDEX_ALIASES: Record<string, string> = {
  "BRVM-C": "BRVM_COMPOSITE",
  BRVMC: "BRVM_COMPOSITE",
  BRVMCOMPOSITE: "BRVM_COMPOSITE",
  COMPOSITE: "BRVM_COMPOSITE",
  "BRVM-30": "BRVM_30",
  BRVM30: "BRVM_30",
  ASI: "NGX_ASI",
  NGXASI: "NGX_ASI",
  "NGX-ASI": "NGX_ASI",
  "NGX-30": "NGX30",
  NGX_30: "NGX30",
};

export function normalizeInstrumentSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/[-\s]+/g, "_");
}

function compactSymbol(raw: string): string {
  return normalizeInstrumentSymbol(raw).replace(/_/g, "");
}

/** Découpe `NGX:DANGCEM` ou `BRVM_COMPOSITE` (sans préfixe). */
export function splitPrefixedSymbol(raw: string): { exchange: string | null; symbol: string } {
  const trimmed = raw.trim();
  const sep = trimmed.indexOf(":");
  if (sep > 0) {
    return {
      exchange: normalizeExchange(trimmed.slice(0, sep)),
      symbol: normalizeInstrumentSymbol(trimmed.slice(sep + 1)),
    };
  }
  return { exchange: null, symbol: normalizeInstrumentSymbol(trimmed) };
}

function aliasIndexCode(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  const underscored = normalizeInstrumentSymbol(upper);
  const compact = compactSymbol(upper);
  return INDEX_ALIASES[upper] ?? INDEX_ALIASES[underscored] ?? INDEX_ALIASES[compact] ?? underscored;
}

export function chartInstrumentKey(ref: ChartInstrumentRef): string {
  return `${normalizeExchange(ref.exchange)}:${ref.kind}:${ref.symbol.trim().toUpperCase()}`;
}

/**
 * URL partageable du workbench.
 * - action BRVM : `?ticker=SNTS` (liens historiques inchangés)
 * - action d'une autre place : `?ticker=NGX:DANGCEM`
 * - indice : `?indice=BRVM_COMPOSITE` ou `?indice=NGX:NGX_ASI`
 */
export function chartWorkbenchHref(entry: ChartInstrumentRef): string {
  const exchange = normalizeExchange(entry.exchange);
  const symbol = entry.symbol.trim().toUpperCase();
  if (entry.kind === "index") {
    const value = exchange === "BRVM" ? symbol : `${exchange}:${symbol}`;
    return `/graphes?indice=${encodeURIComponent(value)}`;
  }
  if (exchange === "BRVM") return `/graphes?ticker=${encodeURIComponent(symbol)}`;
  return `/graphes?ticker=${encodeURIComponent(`${exchange}:${symbol}`)}`;
}

function matchesSymbol(entry: ChartCatalogEntry, symbol: string): boolean {
  const code = aliasIndexCode(symbol);
  return (
    entry.symbol === symbol ||
    entry.symbol === code ||
    compactSymbol(entry.symbol) === compactSymbol(symbol) ||
    compactSymbol(entry.symbol) === compactSymbol(code)
  );
}

function findCompany(
  entries: ChartCatalogEntry[],
  symbol: string,
  exchange: string | null
): ChartCatalogEntry | undefined {
  const pool = entries.filter((entry) => entry.kind === "company");
  if (exchange) {
    return pool.find((entry) => entry.exchange === exchange && matchesSymbol(entry, symbol));
  }
  return (
    pool.find((entry) => entry.exchange === "BRVM" && matchesSymbol(entry, symbol)) ??
    pool.find((entry) => matchesSymbol(entry, symbol))
  );
}

function findIndex(
  entries: ChartCatalogEntry[],
  symbol: string,
  exchange: string | null
): ChartCatalogEntry | undefined {
  const code = aliasIndexCode(symbol);
  const pool = entries.filter((entry) => entry.kind === "index");
  const match = (entry: ChartCatalogEntry) =>
    (!exchange || entry.exchange === exchange) && (matchesSymbol(entry, symbol) || matchesSymbol(entry, code));
  if (exchange) return pool.find(match);
  return pool.find((entry) => entry.exchange === "BRVM" && match(entry)) ?? pool.find(match);
}

/** Instrument visé par l'URL, ou `null` si le paramètre ne correspond à rien. */
export function findChartInstrument(
  params: { ticker?: string | null; indice?: string | null },
  entries: ChartCatalogEntry[]
): ChartCatalogEntry | null {
  const indiceRaw = params.indice?.trim();
  if (indiceRaw) {
    const { exchange, symbol } = splitPrefixedSymbol(indiceRaw);
    return findIndex(entries, symbol, exchange) ?? null;
  }
  const tickerRaw = params.ticker?.trim();
  if (!tickerRaw) return null;
  const { exchange, symbol } = splitPrefixedSymbol(tickerRaw);
  return (
    findCompany(entries, symbol, exchange) ??
    // `?ticker=NGX:NGX_ASI` (ou un code d'indice sans préfixe absent des actions)
    findIndex(entries, symbol, exchange) ??
    null
  );
}

export function defaultChartInstrument(entries: ChartCatalogEntry[]): ChartCatalogEntry | null {
  if (entries.length === 0) return null;
  return (
    entries.find(
      (entry) => entry.kind === "company" && entry.exchange === "BRVM" && entry.symbol === DEFAULT_CHART_TICKER
    ) ??
    entries.find((entry) => entry.kind === "company" && entry.exchange === "BRVM") ??
    entries[0] ??
    null
  );
}

/**
 * Instrument à afficher : paramètre d'URL s'il est connu, sinon ABJC / première action BRVM.
 * Un paramètre inconnu retombe sur le défaut (comportement historique de `?ticker=`).
 */
export function resolveChartInstrument(
  params: { ticker?: string | null; indice?: string | null },
  entries: ChartCatalogEntry[]
): ChartCatalogEntry | null {
  return findChartInstrument(params, entries) ?? defaultChartInstrument(entries);
}

export type ChartUniverseItem = {
  ticker: string;
  name: string;
  color: string;
  sector: string;
  countryFlag: string;
  kind?: "company" | "index";
  exchange?: "BRVM" | "NGX";
};

/** Univers du workbench : BRVM + NGX uniquement, alimenté par le catalogue. */
export function catalogToUniverse(entries: ChartCatalogEntry[]): ChartUniverseItem[] {
  return entries
    .filter((entry) => entry.exchange === "BRVM" || entry.exchange === "NGX")
    .map((entry) => ({
      ticker: entry.symbol,
      name: entry.name,
      color: entry.color,
      sector: entry.sector ?? "",
      countryFlag: entry.countryFlag,
      kind: entry.kind,
      exchange: entry.exchange as "BRVM" | "NGX",
    }));
}

export function universeItemKey(item: {
  ticker: string;
  kind?: "company" | "index";
  exchange?: string | null;
}): string {
  return chartInstrumentKey({
    kind: item.kind ?? "company",
    symbol: item.ticker,
    exchange: item.exchange ?? "BRVM",
  });
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Filtre local (ticker, nom, place, secteur) — identique au catalogue. */
export function filterUniverse(items: ChartUniverseItem[], query: string): ChartUniverseItem[] {
  const needle = fold(query.trim());
  if (!needle) return items;
  return items.filter((item) => {
    const hay = fold(
      `${item.ticker} ${item.name} ${item.exchange ?? ""} ${item.sector} ${item.ticker.replace(/_/g, " ")}`
    );
    return hay.includes(needle);
  });
}

export type UniverseGroup = {
  id: string;
  exchange: string;
  kind: "company" | "index";
  items: ChartUniverseItem[];
};

const GROUP_ORDER = ["BRVM-company", "BRVM-index", "NGX-company", "NGX-index"];

/** Sections du menu de recherche du workbench (places connues d'abord). */
export function groupUniverse(items: ChartUniverseItem[]): UniverseGroup[] {
  const map = new Map<string, UniverseGroup>();
  for (const item of items) {
    const exchange = item.exchange ?? "BRVM";
    const kind = item.kind ?? "company";
    const id = `${exchange}-${kind}`;
    let group = map.get(id);
    if (!group) {
      group = { id, exchange, kind, items: [] };
      map.set(id, group);
    }
    group.items.push(item);
  }
  const known = GROUP_ORDER.map((id) => map.get(id)).filter((g): g is UniverseGroup => Boolean(g));
  const rest = [...map.values()].filter((g) => !GROUP_ORDER.includes(g.id));
  return [...known, ...rest];
}
