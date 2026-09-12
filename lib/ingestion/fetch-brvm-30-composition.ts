// Récupère la composition officielle du BRVM 30 (avis PDF BRVM.org).
// Repli : liste documentée de l'avis n°191-2026 si le scrape échoue.

import { fetchBuffer, fetchHtml } from "./http-client";
import {
  BRVM_30_AVIS_191_2026,
  extractPdfText,
  fallbackBrvm30Avis191,
  parseAvisCompositionLinks,
  parseBrvm30CompositionText,
  toBrvm30Constituents,
} from "./brvm-index-composition";
import { parseDdMmYyyy } from "./parse-utils";
import type { ConnectorResult, RawIndexConstituent } from "./types";

const AVIS_LIST_URL = "https://www.brvm.org/fr/marche/avis-et-publications/avis";
const KNOWN_AVIS_PDF = BRVM_30_AVIS_191_2026.url;

function absolutize(href: string): string {
  if (href.startsWith("http")) return href;
  return `https://www.brvm.org${href.startsWith("/") ? "" : "/"}${href}`;
}

export async function fetchBrvm30Composition(
  knownTickers: Iterable<string>
): Promise<ConnectorResult<RawIndexConstituent[]>> {
  const fetchedAt = new Date().toISOString();
  const known = [...knownTickers];

  try {
    const fromListing = await tryLatestAvisPdf(known);
    if (fromListing && fromListing.tickers.length >= 25) {
      return {
        ok: true,
        source: "BRVM_OFFICIEL",
        data: toBrvm30Constituents(fromListing.tickers, {
          asOf: fromListing.asOf,
          note: fromListing.note,
          fetchedAt,
        }),
        fetchedAt,
      };
    }

    const fromKnown = await tryPdf(KNOWN_AVIS_PDF, known, BRVM_30_AVIS_191_2026.asOf);
    if (fromKnown && fromKnown.length >= 25) {
      return {
        ok: true,
        source: "BRVM_OFFICIEL",
        data: toBrvm30Constituents(fromKnown, {
          asOf: BRVM_30_AVIS_191_2026.asOf,
          note: `Avis ${BRVM_30_AVIS_191_2026.avis} (PDF officiel). Pondérations individuelles N/D.`,
          fetchedAt,
        }),
        fetchedAt,
      };
    }

    return {
      ok: true,
      source: "BRVM_OFFICIEL",
      data: fallbackBrvm30Avis191(),
      fetchedAt,
    };
  } catch {
    return {
      ok: true,
      source: "BRVM_OFFICIEL",
      data: fallbackBrvm30Avis191(),
      fetchedAt,
    };
  }
}

async function tryLatestAvisPdf(
  known: string[]
): Promise<{ tickers: string[]; asOf: string; note: string } | null> {
  try {
    const html = await fetchHtml(AVIS_LIST_URL, { cacheTtlMs: 6 * 60 * 60 * 1000 });
    const links = parseAvisCompositionLinks(html);
    for (const link of links) {
      const url = absolutize(link.href);
      if (!/\.pdf($|\?)/i.test(url)) continue;
      const asOf = link.date ?? guessAsOfFromUrl(url) ?? BRVM_30_AVIS_191_2026.asOf;
      const tickers = await tryPdf(url, known, asOf);
      if (tickers && tickers.length >= 25) {
        return {
          tickers,
          asOf,
          note: `${link.title} (${asOf}). Pondérations individuelles N/D.`,
        };
      }
    }
  } catch {
    /* listing injoignable → repli PDF connu */
  }
  return null;
}

async function tryPdf(url: string, known: string[], asOf: string): Promise<string[] | null> {
  try {
    const buf = await fetchBuffer(url, { cacheTtlMs: 24 * 60 * 60 * 1000 });
    const text = extractPdfText(buf);
    const tickers = parseBrvm30CompositionText(text, known);
    return tickers.length >= 25 ? tickers : null;
  } catch {
    return null;
  }
}

function guessAsOfFromUrl(url: string): string | null {
  const compact = url.match(/(\d{4})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const fr = url.match(/(\d{2})[_-](\d{2})[_-](\d{4})/);
  if (fr) return parseDdMmYyyy(`${fr[1]}/${fr[2]}/${fr[3]}`);
  return null;
}
