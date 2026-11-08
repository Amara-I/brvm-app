import { foldSearchText } from "@/lib/search/fold";
import type { SiteSearchDocument, SiteSearchGroup, SiteSearchHit, SiteSearchKind } from "@/lib/search/types";

const KIND_ORDER: Record<SiteSearchKind, number> = {
  stock: 0,
  index: 1,
  education: 2,
  page: 3,
};

export interface SearchSiteOptions {
  /** Limite les actions et les indices à cette place. Les pages sans place restent visibles. */
  exchange?: string;
  perMarket?: number;
  perSection?: number;
}

export type SearchKeyAction =
  | { type: "move"; index: number }
  | { type: "select"; index: number }
  | { type: "close" }
  | { type: "ignore" };

export function applySearchKey(input: { key: string; index: number; count: number }): SearchKeyAction {
  const { key, index, count } = input;
  if (key === "Escape") return { type: "close" };
  if (key === "ArrowDown") {
    if (count <= 0) return { type: "ignore" };
    return { type: "move", index: Math.min(count - 1, index + 1) };
  }
  if (key === "ArrowUp") {
    if (count <= 0) return { type: "ignore" };
    return { type: "move", index: Math.max(0, index - 1) };
  }
  if (key === "Enter") {
    if (count <= 0) return { type: "ignore" };
    return { type: "select", index: Math.min(Math.max(index, 0), count - 1) };
  }
  return { type: "ignore" };
}

/** Raccourci global « / » ou ⌘K / Ctrl+K, ignoré dans un champ de saisie. */
export function isSearchShortcut(event: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  targetTag?: string;
  editable?: boolean;
}): boolean {
  const tag = (event.targetTag ?? "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || event.editable) return false;
  if (event.altKey) return false;
  if (event.key === "/" && !event.metaKey && !event.ctrlKey) return true;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") return true;
  return false;
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Mot entier si le jeton est court, sinon préfixe de mot (« volat » → « volatilite »). */
function wordHit(hay: string, token: string): boolean {
  if (!token) return false;
  const end = token.length <= 3 ? "(?: |$)" : "";
  return new RegExp(`(?:^| )${escapeRe(token)}${end}`).test(hay);
}

/** « per » matche « PER (Price… », pas « performance ». */
function startsWithPhrase(hay: string, folded: string): boolean {
  if (!hay.startsWith(folded)) return false;
  const next = hay.charAt(folded.length);
  return next === "" || next === " ";
}

function containsPhrase(hay: string, folded: string): boolean {
  if (!folded) return false;
  return new RegExp(`(?:^| )${escapeRe(folded)}(?: |$)`).test(hay);
}

function haystack(doc: SiteSearchDocument): string {
  return foldSearchText(
    [doc.title, doc.titleEn ?? "", doc.subtitle ?? "", doc.subtitleEn ?? "", doc.code ?? "", doc.exchange ?? "", ...(doc.keywords ?? [])].join(
      " ",
    ),
  );
}

function scoreDocument(doc: SiteSearchDocument, folded: string, tokens: string[]): number | null {
  const title = foldSearchText(`${doc.title} ${doc.titleEn ?? ""}`);
  const code = foldSearchText(doc.code ?? "");
  const hay = haystack(doc);

  if (folded.length <= 1) {
    const titleWord = title.split(" ").some((word) => word.startsWith(folded));
    if (code.startsWith(folded)) return 110;
    if (title.startsWith(folded) || titleWord) return 70;
    return null;
  }

  if (code && code === folded) return 120;
  if (code && code.startsWith(folded)) return 110;
  if (title === folded) return 100;
  if (startsWithPhrase(title, folded)) return 90;
  if (tokens.length > 0 && tokens.every((token) => wordHit(title, token) || (code.length > 0 && code.startsWith(token)))) {
    return 80;
  }
  if (containsPhrase(hay, folded)) return 60;
  if (tokens.length > 0 && tokens.every((token) => wordHit(hay, token) || (code.length > 0 && code.startsWith(token)))) {
    return 45;
  }
  return null;
}

function inScope(doc: SiteSearchDocument, exchange: string | undefined): boolean {
  if (!exchange) return true;
  if (doc.kind === "stock" || doc.kind === "index") return (doc.exchange ?? "").toUpperCase() === exchange;
  if (!doc.exchange) return true;
  return doc.exchange.toUpperCase() === exchange;
}

function groupId(hit: SiteSearchHit): string {
  if (hit.kind === "stock" || hit.kind === "index") return `${hit.kind}:${hit.exchange ?? ""}`;
  return hit.kind;
}

/**
 * Recherche groupée. Sans requête : aperçu des actions, plafonné par place
 * pour qu'un univers plus grand n'en masque pas un autre.
 * Les places présentes sont celles des documents, jamais une liste figée.
 */
export function searchSite(documents: SiteSearchDocument[], query: string, options: SearchSiteOptions = {}): SiteSearchGroup[] {
  const folded = foldSearchText(query);
  const tokens = folded.split(" ").filter((token) => token.length >= 2);
  const exchange = options.exchange?.trim() ? options.exchange.trim().toUpperCase() : undefined;
  const perMarket = options.perMarket ?? 5;
  const perSection = options.perSection ?? 6;
  const hits: SiteSearchHit[] = [];

  for (const doc of documents) {
    if (!inScope(doc, exchange)) continue;
    if (!folded) {
      if (doc.kind !== "stock") continue;
      hits.push({ ...doc, score: 1 });
      continue;
    }
    const score = scoreDocument(doc, folded, tokens);
    if (score == null) continue;
    hits.push({ ...doc, score });
  }

  const buckets = new Map<string, SiteSearchHit[]>();
  for (const hit of hits) {
    const key = groupId(hit);
    const list = buckets.get(key);
    if (list) list.push(hit);
    else buckets.set(key, [hit]);
  }

  const groups: SiteSearchGroup[] = [];
  for (const [id, items] of buckets) {
    items.sort(
      (a, b) => b.score - a.score || a.title.localeCompare(b.title, "fr") || (a.code ?? "").localeCompare(b.code ?? "", "fr"),
    );
    const limit = items[0]?.kind === "stock" || items[0]?.kind === "index" ? perMarket : perSection;
    const kept = items.slice(0, limit);
    if (kept.length === 0) continue;
    groups.push({
      id,
      kind: kept[0]!.kind,
      exchange: kept[0]!.kind === "stock" || kept[0]!.kind === "index" ? kept[0]!.exchange : undefined,
      items: kept,
    });
  }

  groups.sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.exchange ?? "").localeCompare(b.exchange ?? "", "fr"),
  );
  return groups;
}
