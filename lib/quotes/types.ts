// Dernier cours « live » d'une action : forme partagée serveur / client.
// Aucune valeur inventée : un champ inconnu vaut null (affiché « N/D »).

export type QuoteMarket = "BRVM" | "NGX";

export interface LatestQuote {
  ticker: string;
  market: QuoteMarket;
  /** Dernière clôture canonique (devise de la place), déjà ramenée sur la base courante (fractionnements). */
  close: number;
  /** Clôture canonique de la séance précédente, même base que `close`, ou null. */
  prevClose: number | null;
  /** Variation de la séance (%) : publiée par la source, sinon recalculée vs `prevClose`. */
  changePercent: number | null;
  /** Écart absolu vs `prevClose`, ou null. */
  changeAbs: number | null;
  /** Date de séance `YYYY-MM-DD`. */
  date: string;
  /** Horodatage ISO de la dernière écriture de ce cours en base. */
  asOf: string;
}

export interface LatestQuotesPayload {
  market: QuoteMarket;
  quotes: LatestQuote[];
  /** Horodatage ISO de lecture (cache serveur compris). */
  generatedAt: string;
}

export function parseQuoteMarket(raw: string | null | undefined): QuoteMarket | null {
  const v = String(raw ?? "").trim().toUpperCase();
  return v === "BRVM" || v === "NGX" ? v : null;
}

/** Normalise une liste de tickers (`A,B`), majuscules, sans doublon, bornée. */
export function parseTickerList(raw: string | null | undefined, max = 200): string[] {
  if (!raw) return [];
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    const t = part.trim().toUpperCase();
    if (/^[A-Z0-9._-]{1,20}$/.test(t)) out.add(t);
    if (out.size >= max) break;
  }
  return [...out];
}

/** Vrai si `next` apporte un cours différent de `prev` (nouvelle séance, correction, nouvelle écriture). */
export function quoteChanged(prev: LatestQuote | null | undefined, next: LatestQuote): boolean {
  if (!prev) return true;
  return prev.date !== next.date || prev.close !== next.close || prev.changePercent !== next.changePercent;
}
