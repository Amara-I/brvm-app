// Source unique du « dernier cours » affiché (fiche, listes, portefeuille, sondage live).
//
// Même lignes que les notifications : 2 dernières clôtures CANONIQUES par société,
// séances futures exclues (garde-fou des proxies 31/12), fractionnements appliqués.
// Une seule requête SQL (LATERAL … LIMIT 2, index price_history(company_id, date)),
// colonnes strictement utiles : ≈ 50 octets par ligne. Résultat mis en cache serveur
// (Next.js data cache) et invalidé par étiquette à chaque écriture de cours
// (lib/cache/revalidate-quotes.ts) : un sondage client ne touche pas la base.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cachedLoader } from "@/lib/cache/market-cache";
import { actionsByTicker } from "@/lib/corporate-actions/load";
import { utcDay } from "@/lib/db/latest-canonical";
import { buildLatestQuotes, type LatestQuoteRow } from "./build-quotes";
import { quoteMarketTag, quoteTickerTag, QUOTES_TAG } from "./tags";
import type { LatestQuote, LatestQuotesPayload, QuoteMarket } from "./types";

/**
 * Filet de sécurité (s) : chaque écriture de cours invalide déjà le cache par
 * étiquette ; ce délai ne couvre qu'une écriture faite hors application.
 */
export const LATEST_QUOTES_REVALIDATE_S = 1800;

export function latestQuotesSql(market: QuoteMarket, tickers: readonly string[] | null, now = new Date()): Prisma.Sql {
  const tickerFilter =
    tickers && tickers.length > 0 ? Prisma.sql`AND c.ticker = ANY(${[...tickers]}::text[])` : Prisma.empty;
  return Prisma.sql`
    SELECT c.ticker, p.date, p.close_price AS close, p.change_percent AS "changePercent", p.ingested_at AS "ingestedAt"
    FROM companies c
    CROSS JOIN LATERAL (
      SELECT ph.date, ph.close_price, ph.change_percent, ph.ingested_at
      FROM price_history ph
      WHERE ph.company_id = c.id
        AND ph.is_canonical = true
        AND ph.date <= ${utcDay(now)}::date
      ORDER BY ph.date DESC
      LIMIT 2
    ) p
    WHERE c.is_active = true
      AND c.exchange::text = ${market}
      ${tickerFilter}
  `;
}

async function loadLatestQuotesUncached(market: QuoteMarket, tickers: string[] | null): Promise<LatestQuotesPayload> {
  const [rows, actions] = await Promise.all([
    prisma.$queryRaw<LatestQuoteRow[]>(latestQuotesSql(market, tickers)),
    actionsByTicker().catch(() => new Map()),
  ]);
  return {
    market,
    quotes: buildLatestQuotes(market, rows, actions),
    generatedAt: new Date().toISOString(),
  };
}

/** Tous les derniers cours d'une place (≈ 48 lignes × 2 BRVM, 146 × 2 NGX), en cache serveur. */
export function getMarketLatestQuotes(market: QuoteMarket): Promise<LatestQuotesPayload> {
  return cachedLoader(
    () => loadLatestQuotesUncached(market, null),
    ["latest-quotes-v1", market],
    { revalidate: LATEST_QUOTES_REVALIDATE_S, tags: [QUOTES_TAG, quoteMarketTag(market)] }
  )();
}

/** Dernier cours d'un seul titre (2 lignes lues), étiqueté `quote:TICKER`. */
export async function getTickerLatestQuote(market: QuoteMarket, ticker: string): Promise<LatestQuote | null> {
  const t = ticker.toUpperCase();
  const payload = await cachedLoader(
    () => loadLatestQuotesUncached(market, [t]),
    ["latest-quote-v1", market, t],
    { revalidate: LATEST_QUOTES_REVALIDATE_S, tags: [QUOTES_TAG, quoteMarketTag(market), quoteTickerTag(t)] }
  )();
  return payload.quotes.find((q) => q.ticker === t) ?? null;
}

/** Sous-ensemble de tickers : 1 titre → entrée dédiée ; sinon la place entière filtrée (même entrée de cache). */
export async function getLatestQuotes(market: QuoteMarket, tickers: readonly string[]): Promise<LatestQuotesPayload> {
  if (tickers.length === 1) {
    const quote = await getTickerLatestQuote(market, tickers[0]!);
    return { market, quotes: quote ? [quote] : [], generatedAt: new Date().toISOString() };
  }
  const all = await getMarketLatestQuotes(market);
  if (tickers.length === 0) return all;
  const wanted = new Set(tickers.map((t) => t.toUpperCase()));
  return { ...all, quotes: all.quotes.filter((q) => wanted.has(q.ticker)) };
}

/** Index ticker → dernier cours (pratique côté serveur pour superposer une série). */
export async function getMarketLatestQuoteMap(market: QuoteMarket): Promise<Map<string, LatestQuote>> {
  const payload = await getMarketLatestQuotes(market);
  return new Map(payload.quotes.map((q) => [q.ticker, q]));
}
