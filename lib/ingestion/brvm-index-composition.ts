// Composition officielle BRVM 30 — parseurs purs + repli documenté.
// Aucun ticker inventé : extraits d'un avis BRVM, ou liste figée de l'avis
// n°191-2026 / BRVM / DG (1er juillet 2026) si le PDF n'est pas lisible.

import type { RawIndexConstituent } from "./types";

/** Avis n°191-2026 / BRVM / DG du 1er juillet 2026 — 30 titres officiels. */
export const BRVM_30_AVIS_191_2026 = {
  asOf: "2026-07-01",
  avis: "191-2026 / BRVM / DG",
  url: "https://www.brvm.org/sites/default/files/20260701_-_avis_ndeg191_brvmdg_-_composition_de_lindice_brvm_30.pdf",
  tickers: [
    "SDSC",
    "BOABF",
    "BOAB",
    "BOAC",
    "BOAM",
    "BOAN",
    "BOAS",
    "BICB",
    "CFAC",
    "CIEC",
    "CBIBF",
    "ECOC",
    "ETIT",
    "SIVC",
    "SEMC",
    "NEIC",
    "NSBC",
    "ORGT",
    "ORAC",
    "SAFC",
    "SPHC",
    "STAC",
    "STBC",
    "SGBC",
    "SIBC",
    "SOGC",
    "SNTS",
    "SCRC",
    "TTLC",
    "UNXC",
  ],
} as const;

export function extractTickerCandidates(text: string): string[] {
  const matches = text.toUpperCase().match(/\b[A-Z]{3,6}\b/g) ?? [];
  return matches;
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2;
  if (a.length === b.length) {
    let diffs = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diffs++;
    return diffs;
  }
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i++;
      j++;
      continue;
    }
    edits++;
    j++;
    if (edits > 1) return edits;
  }
  return edits + (longer.length - j);
}

/** Aligne un jeton OCR (ex. TILC) sur un ticker connu (TTLC), si le match est unique. */
export function resolveKnownTicker(token: string, knownTickers: Iterable<string>): string | null {
  const t = token.toUpperCase();
  const known = [...new Set([...knownTickers].map((x) => x.toUpperCase()))];
  if (known.includes(t)) return t;
  const near = known.filter((k) => editDistance(t, k) === 1);
  return near.length === 1 ? near[0]! : null;
}

export function parseBrvm30CompositionText(
  text: string,
  knownTickers: Iterable<string>
): string[] {
  const known = [...knownTickers].map((t) => t.toUpperCase());
  const hasHeader = /composition se pr[eé]sente|se pr[eé]sente comme suit/i.test(text);
  const compositionSlice = sliceCompositionBody(text);
  const exact: string[] = [];
  const fuzzy: string[] = [];
  const seen = new Set<string>();

  for (const token of extractTickerCandidates(compositionSlice)) {
    const upper = token.toUpperCase();
    if (known.includes(upper) && !seen.has(upper)) {
      seen.add(upper);
      exact.push(upper);
      continue;
    }
    if (!hasHeader) continue;
    const ticker = resolveKnownTicker(token, known);
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    fuzzy.push(ticker);
  }

  // PDF image / binaire : sans en-tête lisible on n'accepte que des
  // correspondances exactes (évite les faux positifs OCR sur du bruit).
  if (!hasHeader) return exact.length >= 25 ? exact.slice(0, 30) : [];
  return [...exact, ...fuzzy].slice(0, 30);
}

function sliceCompositionBody(text: string): string {
  const upper = text.replace(/\s+/g, " ");
  const start = upper.search(/composition se pr[eé]sente|se pr[eé]sente comme suit/i);
  const end = upper.search(/soci[eé]t[eé]s sortant|par cette mise/i);
  if (start >= 0) {
    const from = start;
    const to = end > from ? end : from + 2_500;
    return upper.slice(from, to);
  }
  return upper;
}

export function toBrvm30Constituents(
  tickers: readonly string[],
  opts: { asOf: string; note: string; fetchedAt?: string }
): RawIndexConstituent[] {
  return tickers.map((ticker) => ({
    indexCode: "BRVM_30",
    ticker: ticker.toUpperCase(),
    weight: null,
    source: "BRVM_OFFICIEL" as const,
    asOf: opts.asOf,
    note: opts.note,
  }));
}

export function fallbackBrvm30Avis191(): RawIndexConstituent[] {
  return toBrvm30Constituents(BRVM_30_AVIS_191_2026.tickers, {
    asOf: BRVM_30_AVIS_191_2026.asOf,
    note: `Avis ${BRVM_30_AVIS_191_2026.avis} — liste officielle (repli documenté).`,
  });
}

export function parseAvisCompositionLinks(html: string): Array<{ title: string; href: string; date: string | null }> {
  const results: Array<{ title: string; href: string; date: string | null }> = [];
  const rowRe =
    /<a[^>]+href="([^"]+)"[^>]*>([^<]*(?:composition|indice)[^<]*BRVM[^<]*30[^<]*)<\/a>[\s\S]{0,400}?(\d{2}\/\d{2}\/\d{4})/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    results.push({
      href: m[1]!,
      title: m[2]!.replace(/\s+/g, " ").trim(),
      date: toIsoFromFr(m[3]!),
    });
  }
  if (results.length === 0) {
    const hrefRe = /href="([^"]*(?:composition[^"]*brvm[_-]?30|brvm[_-]?30[^"]*composition)[^"]*)"/gi;
    while ((m = hrefRe.exec(html)) !== null) {
      results.push({ href: m[1]!, title: "Composition BRVM 30", date: null });
    }
  }
  return results;
}

function toIsoFromFr(raw: string): string | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Extrait le texte visible d'un PDF (flux brut) — best-effort, sans dépendance. */
export function extractPdfText(buffer: ArrayBuffer | Buffer): string {
  const bytes = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
  const latin = bytes.toString("latin1");
  const chunks: string[] = [];
  const paren = /\((?:\\.|[^\\)]){2,80}\)/g;
  let m: RegExpExecArray | null;
  while ((m = paren.exec(latin)) !== null) {
    const inner = m[0]
      .slice(1, -1)
      .replace(/\\n/g, " ")
      .replace(/\\(.)/g, "$1");
    if (/[A-Za-z]{2,}/.test(inner)) chunks.push(inner);
  }
  const compact = latin.replace(/[^\x20-\x7EÀ-ÿ\n]/g, " ");
  return `${chunks.join(" ")}\n${compact}`;
}
