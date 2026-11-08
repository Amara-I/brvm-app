import { companyHref, indexHref, normalizeExchange } from "@/lib/search/routes";
import { SITE_SEARCH_KINDS, type SiteSearchDocument, type SiteSearchKind } from "@/lib/search/types";

export interface StockSearchSource {
  ticker: string;
  name: string;
  sector: string;
  exchange?: string | null;
}

export interface IndexSearchSource {
  code: string;
  name: string;
  exchange?: string | null;
}

export function stockDocument(item: StockSearchSource): SiteSearchDocument {
  const exchange = normalizeExchange(item.exchange);
  const ticker = item.ticker.trim().toUpperCase();
  return {
    id: `stock:${exchange}:${ticker}`,
    kind: "stock",
    title: item.name,
    subtitle: item.sector,
    href: companyHref({ ticker, exchange }),
    exchange,
    code: ticker,
    keywords: [item.sector, exchange],
  };
}

export function indexDocument(item: IndexSearchSource): SiteSearchDocument {
  const exchange = normalizeExchange(item.exchange);
  const code = item.code.trim().toUpperCase();
  return {
    id: `index:${exchange}:${code}`,
    kind: "index",
    title: item.name,
    subtitle: exchange,
    href: indexHref({ code, exchange }),
    exchange,
    code,
    keywords: [code.replace(/[_-]+/g, " "), exchange, item.name],
  };
}

function isKind(value: unknown): value is SiteSearchKind {
  return typeof value === "string" && (SITE_SEARCH_KINDS as readonly string[]).includes(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function parseSearchDocument(value: unknown): SiteSearchDocument | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.title !== "string" || typeof row.href !== "string") return null;
  if (!row.href.startsWith("/") || row.href.startsWith("//")) return null;
  if (!isKind(row.kind)) return null;
  const keywords = Array.isArray(row.keywords)
    ? row.keywords.filter((keyword): keyword is string => typeof keyword === "string").slice(0, 32)
    : undefined;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    titleEn: optionalString(row.titleEn),
    subtitle: optionalString(row.subtitle),
    subtitleEn: optionalString(row.subtitleEn),
    href: row.href,
    exchange: optionalString(row.exchange),
    code: optionalString(row.code),
    keywords,
  };
}

/** Accepte l'enveloppe `{ data: { documents } }` ou `{ documents }`. */
export function parseSearchCatalog(body: unknown): SiteSearchDocument[] | null {
  const data =
    body && typeof body === "object" && "data" in body ? (body as { data?: unknown }).data : body;
  const documents =
    data && typeof data === "object" && "documents" in data
      ? (data as { documents?: unknown }).documents
      : null;
  if (!Array.isArray(documents)) return null;
  return documents.map(parseSearchDocument).filter((doc): doc is SiteSearchDocument => doc !== null);
}
