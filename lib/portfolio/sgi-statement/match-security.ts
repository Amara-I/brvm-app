import { TICKER_ALIASES, TICKER_ALIAS_PHRASES } from "./aliases";
import { fold, includesPhrase } from "./fold";
import type { MatchConfidence, MatchReason, SecurityCatalogEntry, SecurityMatch } from "./types";

const STOPWORDS = new Set([
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "et",
  "sa",
  "ex",
  "d",
  "group",
  "groupe",
  "societe",
  "compagnie",
  "holding",
]);

/** Trop génériques pour départager une société à eux seuls. */
const GENERIC_TOKENS = new Set([
  "societe",
  "compagnie",
  "banque",
  "bank",
  "national",
  "nationale",
  "international",
  "internationale",
  "finance",
  "holding",
  "groupe",
  "group",
]);

const COUNTRY_GROUPS: readonly (readonly string[])[] = [
  ["ci", "ivoire", "ivoirienne", "ivoirien", "cote"],
  ["sn", "senegal"],
  ["bj", "benin"],
  ["bf", "burkina", "faso"],
  ["ml", "mali"],
  ["ne", "niger"],
  ["tg", "togo"],
];

const ISIN_RE = /\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b/;

export function extractIsin(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.toUpperCase().replace(/\s/g, "").match(ISIN_RE);
  return match?.[1] ?? null;
}

type Prepared = {
  entry: SecurityCatalogEntry;
  foldedName: string;
  rawTokens: string[];
  expanded: string[];
};

export type SecurityMatcher = (label: string, isin?: string | null) => SecurityMatch;

function tokensOf(foldedValue: string): string[] {
  return foldedValue.split(" ").filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function expand(tokens: readonly string[]): string[] {
  const set = new Set(tokens);
  for (const group of COUNTRY_GROUPS) {
    if (group.some((token) => set.has(token))) {
      for (const token of group) set.add(token);
    }
  }
  return [...set];
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = row[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length] ?? Math.max(a.length, b.length);
}

function emptyMatch(candidates: SecurityMatch["candidates"] = []): SecurityMatch {
  return {
    companyId: null,
    ticker: null,
    name: null,
    confidence: "aucune",
    score: 0,
    ambiguous: false,
    reason: "aucune",
    candidates,
  };
}

function toConfidence(score: number, ambiguous: boolean): MatchConfidence {
  if (score < 0.55) return "aucune";
  if (ambiguous) return score >= 0.88 ? "moyenne" : "faible";
  if (score >= 0.88) return "haute";
  if (score >= 0.72) return "moyenne";
  return "faible";
}

function pack(
  entry: SecurityCatalogEntry,
  score: number,
  reason: MatchReason,
  ambiguous: boolean,
  candidates: SecurityMatch["candidates"]
): SecurityMatch {
  const confidence = toConfidence(score, ambiguous);
  return {
    companyId: confidence === "aucune" ? null : entry.id,
    ticker: confidence === "aucune" ? null : entry.ticker,
    name: confidence === "aucune" ? null : entry.name,
    confidence,
    score: Math.round(score * 1000) / 1000,
    ambiguous: confidence === "aucune" ? false : ambiguous,
    reason: confidence === "aucune" ? "aucune" : reason,
    candidates,
  };
}

export function createSecurityMatcher(catalog: readonly SecurityCatalogEntry[]): SecurityMatcher {
  const prepared: Prepared[] = catalog.map((entry) => {
    const foldedName = fold(entry.name);
    const rawTokens = tokensOf(foldedName);
    return { entry, foldedName, rawTokens, expanded: expand(rawTokens) };
  });

  const byTicker = new Map(prepared.map((item) => [item.entry.ticker.toUpperCase(), item]));
  const byIsin = new Map(
    prepared
      .filter((item) => item.entry.isin)
      .map((item) => [item.entry.isin!.toUpperCase().replace(/\s/g, ""), item])
  );

  const owners = new Map<string, string[]>();
  for (const item of prepared) {
    for (const token of item.rawTokens) {
      if (token.length < 5) continue;
      const list = owners.get(token) ?? [];
      list.push(item.entry.ticker);
      owners.set(token, list);
    }
  }

  const tickerPattern =
    prepared.length === 0
      ? null
      : new RegExp(
          `\\b(${prepared
            .map((item) => item.entry.ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .sort((a, b) => b.length - a.length)
            .join("|")})\\b`,
          "gi"
        );

  return (label, isin) => {
    const cleaned = label.replace(/\s+/g, " ").trim();
    if (!cleaned && !isin) return emptyMatch();

    const isinCode = (isin ? extractIsin(isin) : null) ?? extractIsin(cleaned);
    if (isinCode) {
      const hit = byIsin.get(isinCode);
      if (hit) return pack(hit.entry, 1, "isin", false, [candidate(hit, 1)]);
    }

    if (tickerPattern) {
      const found = new Set<string>();
      tickerPattern.lastIndex = 0;
      for (const match of cleaned.matchAll(tickerPattern)) {
        if (match[1]) found.add(match[1].toUpperCase());
      }
      if (found.size === 1) {
        const hit = byTicker.get([...found][0]!);
        if (hit) return pack(hit.entry, 0.99, "ticker", false, [candidate(hit, 0.99)]);
      }
      if (found.size > 1) {
        const hits = [...found].map((ticker) => byTicker.get(ticker)).filter((item): item is Prepared => !!item);
        const candidates = hits.slice(0, 4).map((item) => candidate(item, 0.8));
        if (hits[0]) return pack(hits[0].entry, 0.8, "ticker", true, candidates);
      }
    }

    const foldedLabel = fold(cleaned.replace(ISIN_RE, " "));
    const aliasTicker = TICKER_ALIASES.get(foldedLabel);
    if (aliasTicker) {
      const hit = byTicker.get(aliasTicker);
      if (hit) return pack(hit.entry, 0.96, "alias", false, [candidate(hit, 0.96)]);
    }

    const phraseHits: Prepared[] = [];
    for (const alias of TICKER_ALIAS_PHRASES) {
      if (!includesPhrase(foldedLabel, alias.phrase)) continue;
      const hit = byTicker.get(alias.ticker);
      if (!hit) continue;
      if (phraseHits.some((item) => item.entry.ticker === hit.entry.ticker)) continue;
      phraseHits.push(hit);
      if (phraseHits.length === 1) break;
    }
    if (phraseHits.length === 1) {
      return pack(phraseHits[0]!.entry, 0.96, "alias", false, [candidate(phraseHits[0]!, 0.96)]);
    }
    if (phraseHits.length > 1) {
      return pack(
        phraseHits[0]!.entry,
        0.8,
        "alias",
        true,
        phraseHits.slice(0, 4).map((item) => candidate(item, 0.8))
      );
    }

    const exact = prepared.find((item) => item.foldedName === foldedLabel);
    if (exact) return pack(exact.entry, 0.97, "nom", false, [candidate(exact, 0.97)]);

    const labelRaw = tokensOf(foldedLabel);
    const labelExpanded = new Set(expand(labelRaw));
    const scored = prepared
      .map((item) => ({ item, score: scoreItem(item, foldedLabel, labelRaw, labelExpanded, owners) }))
      .filter((row) => row.score >= 0.4)
      .sort((a, b) => b.score - a.score);

    const candidates = scored.slice(0, 4).map((row) => candidate(row.item, row.score));
    const best = scored[0];
    if (!best) return emptyMatch(candidates);
    const second = scored[1];
    const ambiguous = !!second && second.score >= 0.55 && best.score - second.score < 0.08;
    return pack(best.item.entry, best.score, "approche", ambiguous, candidates);
  };
}

function candidate(item: Prepared, score: number): SecurityMatch["candidates"][number] {
  return {
    companyId: item.entry.id,
    ticker: item.entry.ticker,
    name: item.entry.name,
    score: Math.round(score * 1000) / 1000,
  };
}

function scoreItem(
  item: Prepared,
  foldedLabel: string,
  labelRaw: string[],
  labelExpanded: Set<string>,
  owners: Map<string, string[]>
): number {
  let score = 0;
  const companySet = new Set(item.expanded);
  let inter = 0;
  for (const token of companySet) if (labelExpanded.has(token)) inter += 1;
  const union = new Set([...companySet, ...labelExpanded]).size;
  if (union > 0 && inter > 0) score = Math.max(score, inter / union);

  const subset =
    item.expanded.length >= 2 &&
    item.expanded.every((token) => labelExpanded.has(token)) &&
    item.rawTokens.some((token) => token.length >= 4 || labelRaw.includes(token));
  if (subset) {
    const extra = [...labelExpanded].filter((token) => !companySet.has(token)).length;
    score = Math.max(score, extra === 0 ? 0.95 : extra <= 2 ? 0.9 : 0.82);
  }

  for (const token of labelRaw) {
    if (token.length < 5 || GENERIC_TOKENS.has(token) || !item.rawTokens.includes(token)) continue;
    const tokenOwners = owners.get(token) ?? [];
    if (tokenOwners.length === 1) score = Math.max(score, 0.9);
  }

  if (foldedLabel.length >= 6 && item.foldedName.length >= 6 && Math.abs(foldedLabel.length - item.foldedName.length) <= 3) {
    const dist = levenshtein(foldedLabel, item.foldedName);
    const ratio = 1 - dist / Math.max(foldedLabel.length, item.foldedName.length);
    if (ratio >= 0.92) score = Math.max(score, 0.9);
    else if (ratio >= 0.84) score = Math.max(score, 0.8);
  }

  return score;
}
